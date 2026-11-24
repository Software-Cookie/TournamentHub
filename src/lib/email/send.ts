import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };

export type SendEmailInput = {
  /** Unique key per logical email. The same key is never delivered twice. */
  dedupeKey: string;
  template: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | null;
  fromName?: string | null;
  userId?: string | null;
  tournamentId?: string | null;
  notificationId?: string | null;
  /** Lazily build attachments (e.g. ticket PDF) so retries can regenerate them. */
  attachments?: () => Promise<EmailAttachment[]>;
  /** Extra data stored on the log for retries. */
  meta?: Prisma.InputJsonValue;
};

const MAX_ATTEMPTS = 5;

async function deliver(input: { to: string; subject: string; html: string; text?: string; replyTo?: string | null; fromName?: string | null; attachments?: EmailAttachment[] }) {
  if (!env.resend.apiKey) {
    if (!env.emailConsoleFallback) throw new Error("RESEND_API_KEY is not configured");
    // Development fallback: print to the server console.
    const links = [...input.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((l) => l && !l.startsWith("mailto:"));
    console.info(
      `\n📧 [dev email] to=${input.to}\n   subject: ${input.subject}\n   links: ${links.slice(0, 4).join("\n          ")}${input.attachments?.length ? `\n   attachments: ${input.attachments.map((a) => a.filename).join(", ")}` : ""}\n`,
    );
    return { id: `console-${Date.now()}` };
  }
  let from = env.resend.from;
  if (input.fromName) {
    const addr = from.match(/<([^>]+)>/)?.[1] ?? from;
    from = `${input.fromName.replace(/[<>"]/g, "")} <${addr}>`;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resend.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo || undefined,
      attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), content_type: a.contentType })),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(body.message || `Resend error ${res.status}`);
  return { id: body.id ?? "" };
}

/**
 * Send a transactional email exactly once per dedupeKey.
 * Returns the resulting status. Never throws (failures are logged and retried by the cron job).
 */
export async function sendEmail(input: SendEmailInput): Promise<"SENT" | "SKIPPED" | "FAILED"> {
  let log;
  try {
    log = await db.emailLog.create({
      data: {
        dedupeKey: input.dedupeKey,
        template: input.template,
        to: input.to.toLowerCase(),
        subject: input.subject,
        userId: input.userId ?? null,
        tournamentId: input.tournamentId ?? null,
        notificationId: input.notificationId ?? null,
        payload: { html: input.html, text: input.text ?? null, replyTo: input.replyTo ?? null, fromName: input.fromName ?? null, meta: input.meta ?? null },
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await db.emailLog.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (!existing || existing.status === "SENT" || existing.status === "SKIPPED" || existing.attempts >= MAX_ATTEMPTS) return "SKIPPED";
      log = existing; // previously failed — retry now
    } else {
      console.error("sendEmail: failed to create log", e);
      return "FAILED";
    }
  }

  try {
    const attachments = input.attachments ? await input.attachments() : undefined;
    const result = await deliver({ ...input, attachments });
    await db.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT", providerId: result.id, sentAt: new Date(), attempts: { increment: 1 }, error: null },
    });
    return "SENT";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`sendEmail failed (${input.dedupeKey}):`, message);
    await db.emailLog.update({ where: { id: log.id }, data: { status: "FAILED", error: message.slice(0, 500), attempts: { increment: 1 } } });
    return "FAILED";
  }
}

/** Retry failed emails (called by cron). Attachments are not regenerated here except tickets. */
export async function retryFailedEmails(limit = 25) {
  const failed = await db.emailLog.findMany({
    where: { status: "FAILED", attempts: { lt: MAX_ATTEMPTS }, updatedAt: { lt: new Date(Date.now() - 5 * 60_000) } },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });
  let sent = 0;
  for (const log of failed) {
    const p = (log.payload ?? {}) as { html?: string; text?: string | null; replyTo?: string | null; fromName?: string | null; meta?: { ticketRegistrationId?: string } | null };
    if (!p.html) continue;
    try {
      let attachments: EmailAttachment[] | undefined;
      if (p.meta?.ticketRegistrationId) {
        const { renderTicketPdf } = await import("@/lib/tickets");
        const pdf = await renderTicketPdf(p.meta.ticketRegistrationId);
        if (pdf) attachments = [{ filename: pdf.filename, content: Buffer.from(pdf.bytes), contentType: "application/pdf" }];
      }
      const r = await deliver({ to: log.to, subject: log.subject, html: p.html, text: p.text ?? undefined, replyTo: p.replyTo, fromName: p.fromName, attachments });
      await db.emailLog.update({ where: { id: log.id }, data: { status: "SENT", providerId: r.id, sentAt: new Date(), attempts: { increment: 1 }, error: null } });
      sent++;
    } catch (e) {
      await db.emailLog.update({ where: { id: log.id }, data: { error: String(e instanceof Error ? e.message : e).slice(0, 500), attempts: { increment: 1 } } });
    }
  }
  return { retried: failed.length, sent };
}
