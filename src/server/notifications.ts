import "server-only";
import type { NotificationAudience, NotificationChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/send";
import * as T from "@/lib/email/templates";
import { registrationEmailData, expireStaleHolds, confirmPayment, markPaymentFailed } from "@/server/registrations";
import { retryFailedEmails } from "@/lib/email/send";
import { fetchOrderPayments } from "@/lib/payments/razorpay";
import { confirmListingPayment, markListingFailed } from "@/server/listings";
import { confirmMembershipPayment, markMembershipFailed } from "@/server/membership";
import type { SessionUser } from "@/lib/authz";

// ─── Channel abstraction (email now; SMS / WhatsApp later) ────────────

export type Recipient = { email: string; phone?: string | null; name: string; userId?: string | null };
type ChannelMessage = { dedupeKey: string; subject: string; body: string; tournament: { id: string; name: string; slug: string; bannerUrl: string | null; emailReplyTo: string | null; emailSenderName: string | null }; notificationId: string };

interface ChannelAdapter {
  available(): boolean;
  send(r: Recipient, m: ChannelMessage): Promise<"SENT" | "SKIPPED" | "FAILED">;
}

const channels: Record<NotificationChannel, ChannelAdapter> = {
  EMAIL: {
    available: () => true,
    async send(r, m) {
      const tpl = T.broadcastTemplate({ recipientName: r.name, tournamentName: m.tournament.name, subject: m.subject, body: m.body, bannerUrl: m.tournament.bannerUrl, url: `${env.appUrl}/tournaments/${m.tournament.slug}` });
      return sendEmail({ dedupeKey: m.dedupeKey, template: "broadcast", to: r.email, ...tpl, replyTo: m.tournament.emailReplyTo, fromName: m.tournament.emailSenderName, userId: r.userId, tournamentId: m.tournament.id, notificationId: m.notificationId });
    },
  },
  // Plug in an SMS / WhatsApp provider here (e.g. MSG91, Twilio, Gupshup) — the rest of the system is channel-agnostic.
  SMS: { available: () => false, send: async () => "SKIPPED" },
  WHATSAPP: { available: () => false, send: async () => "SKIPPED" },
};

export function availableChannels() {
  return (Object.keys(channels) as NotificationChannel[]).filter((c) => channels[c].available());
}

export async function resolveAudience(tournamentId: string, audience: NotificationAudience, filter: { categoryId?: string; registrationIds?: string[] }) {
  const where: Prisma.RegistrationWhereInput = { tournamentId, status: { in: ["CONFIRMED", "PENDING_APPROVAL"] } };
  if (audience === "CATEGORY") {
    if (!filter.categoryId) throw new Error("Choose a category.");
    where.categoryId = filter.categoryId;
  }
  if (audience === "TEAM" || audience === "SELECTED") {
    if (!filter.registrationIds?.length) throw new Error("Choose at least one recipient.");
    where.id = { in: filter.registrationIds };
  }
  const regs = await db.registration.findMany({ where, include: { participants: true, user: { select: { id: true, email: true, name: true } } } });
  const map = new Map<string, Recipient>();
  for (const r of regs) {
    const ownerEmail = r.user.email.toLowerCase();
    if (!map.has(ownerEmail)) map.set(ownerEmail, { email: ownerEmail, name: r.participants[0]?.fullName ?? r.user.name ?? "Player", userId: r.user.id, phone: r.participants[0]?.phone });
    for (const p of r.participants) {
      if (!p.email) continue;
      const e = p.email.toLowerCase();
      if (!map.has(e)) map.set(e, { email: e, name: p.fullName, phone: p.phone });
    }
  }
  return [...map.values()];
}

export async function sendBroadcast(
  actor: SessionUser,
  input: { tournamentId: string; audience: NotificationAudience; categoryId?: string; registrationIds?: string[]; subject: string; body: string; channel?: NotificationChannel },
) {
  const channel = input.channel ?? "EMAIL";
  if (!channels[channel].available()) throw new Error(`${channel} notifications are not configured yet.`);
  const tournament = await db.tournament.findUnique({ where: { id: input.tournamentId }, select: { id: true, name: true, slug: true, bannerUrl: true, emailReplyTo: true, emailSenderName: true } });
  if (!tournament) throw new Error("Tournament not found.");
  const recipients = await resolveAudience(input.tournamentId, input.audience, input);
  if (!recipients.length) throw new Error("No recipients match this audience.");

  const notification = await db.notification.create({
    data: {
      tournamentId: input.tournamentId,
      channel,
      audience: input.audience,
      audienceFilter: { categoryId: input.categoryId ?? null, registrationIds: input.registrationIds ?? [] },
      subject: input.subject,
      body: input.body,
      recipientCount: recipients.length,
      createdById: actor.id,
    },
  });
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const status = await channels[channel].send(r, { dedupeKey: `broadcast:${notification.id}:${r.email}`, subject: input.subject, body: input.body, tournament, notificationId: notification.id });
    if (status === "SENT") sent++;
    if (status === "FAILED") failed++;
  }
  await db.notification.update({ where: { id: notification.id }, data: { sentCount: sent, failedCount: failed } });
  await audit({ actorId: actor.id, action: "notification.sent", entityType: "Notification", entityId: notification.id, metadata: { audience: input.audience, recipients: recipients.length, sent, failed } });
  return { recipients: recipients.length, sent, failed };
}

// ─── Scheduled jobs ───────────────────────────────────────────

export async function runReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + 72 * 3600_000);
  const tournaments = await db.tournament.findMany({
    where: { status: { in: ["PUBLISHED", "ONGOING"] }, startDate: { gt: new Date(now.getTime() - 12 * 3600_000), lte: horizon } },
    select: { id: true, startDate: true, reminderOffsetsHours: true },
  });
  let sent = 0;
  for (const t of tournaments) {
    for (const offset of t.reminderOffsetsHours) {
      const sendAt = new Date(t.startDate.getTime() - offset * 3600_000);
      // Send once the time has come, but never after the tournament has started (stale reminders are useless).
      if (now < sendAt || now > t.startDate) continue;
      const regs = await db.registration.findMany({ where: { tournamentId: t.id, status: "CONFIRMED" }, select: { id: true } });
      for (const r of regs) {
        const x = await registrationEmailData(r.id);
        if (!x) continue;
        for (const [to, name] of x.recipients) {
          const tpl = T.reminderTemplate({ ...x.data, participantName: name, hoursBefore: offset, isDayOf: offset < 12 });
          const res = await sendEmail({ dedupeKey: `reminder:${offset}:${r.id}:${to}`, template: offset < 12 ? "reminder_dayof" : "reminder", to, ...tpl, tournamentId: t.id, replyTo: x.reg.tournament.emailReplyTo, fromName: x.reg.tournament.emailSenderName });
          if (res === "SENT") sent++;
        }
      }
    }
  }
  // Move tournaments to ONGOING on their start day.
  await db.tournament.updateMany({ where: { status: "PUBLISHED", startDate: { lte: now } }, data: { status: "ONGOING" } });
  return { tournaments: tournaments.length, sent };
}

/** Recover payments whose checkout callback never reached us and the webhook was missed. */
export async function reconcilePayments() {
  const stale = await db.payment.findMany({
    where: { status: { in: ["CREATED", "PENDING"] }, createdAt: { lt: new Date(Date.now() - 10 * 60_000), gt: new Date(Date.now() - 3 * 86400_000) } },
    take: 30,
  });
  let confirmed = 0;
  for (const p of stale) {
    try {
      const items = await fetchOrderPayments(p.providerOrderId);
      const captured = items.find((i) => i.status === "captured" || i.status === "authorized");
      if (captured) {
        await confirmPayment({ orderId: p.providerOrderId, paymentId: captured.id, via: "reconcile" });
        confirmed++;
      } else if (items.length && items.every((i) => i.status === "failed")) {
        await markPaymentFailed(p.providerOrderId, items[0]?.error_description ?? "Payment failed");
      }
    } catch (e) {
      console.error("reconcile failed for", p.providerOrderId, e);
    }
  }
  const staleListings = await db.listingFee.findMany({
    where: { status: "CREATED", createdAt: { lt: new Date(Date.now() - 10 * 60_000), gt: new Date(Date.now() - 3 * 86400_000) } },
    take: 20,
  });
  for (const l of staleListings) {
    try {
      const items = await fetchOrderPayments(l.providerOrderId);
      const captured = items.find((i) => i.status === "captured" || i.status === "authorized");
      if (captured) {
        await confirmListingPayment({ orderId: l.providerOrderId, paymentId: captured.id, via: "reconcile" });
        confirmed++;
      } else if (items.length && items.every((i) => i.status === "failed")) {
        await markListingFailed(l.providerOrderId, items[0]?.error_description ?? "Payment failed");
      }
    } catch (e) {
      console.error("listing reconcile failed for", l.providerOrderId, e);
    }
  }
  const staleMemberships = await db.premiumMembership.findMany({
    where: { status: "CREATED", createdAt: { lt: new Date(Date.now() - 10 * 60_000), gt: new Date(Date.now() - 3 * 86400_000) } },
    take: 20,
  });
  for (const m of staleMemberships) {
    try {
      const items = await fetchOrderPayments(m.providerOrderId);
      const captured = items.find((i) => i.status === "captured" || i.status === "authorized");
      if (captured) {
        await confirmMembershipPayment({ orderId: m.providerOrderId, paymentId: captured.id, via: "reconcile" });
        confirmed++;
      } else if (items.length && items.every((i) => i.status === "failed")) {
        await markMembershipFailed(m.providerOrderId, items[0]?.error_description ?? "Payment failed");
      }
    } catch (e) {
      console.error("premium reconcile failed for", m.providerOrderId, e);
    }
  }
  return { checked: stale.length + staleListings.length + staleMemberships.length, confirmed };
}

export async function runAllJobs() {
  const expired = await expireStaleHolds();
  const reconcile = await reconcilePayments();
  const reminders = await runReminders();
  const retries = await retryFailedEmails();
  return { expired, reconcile, reminders, retries };
}
