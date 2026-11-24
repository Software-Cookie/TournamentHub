import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { humanCode, randomToken } from "@/lib/tokens";
import { formatDate, formatMoney, mapsLink } from "@/lib/utils";

export const DEFAULT_INSTRUCTIONS =
  "Please arrive at the tournament venue at least 15 minutes before your scheduled match. Report to the registration desk for verification. Carry your ticket and a valid identification document.";

export function ticketVerifyUrl(qrToken: string) {
  return `${env.appUrl}/verify/${qrToken}`;
}

/** Idempotently issue a ticket for a confirmed registration (inside the confirming transaction). */
export async function issueTicket(tx: Prisma.TransactionClient, registrationId: string) {
  const existing = await tx.ticket.findUnique({ where: { registrationId } });
  if (existing) return existing;
  const year = new Date().getFullYear();
  return tx.ticket.create({
    data: { registrationId, number: `TKT-${year}-${humanCode(7)}`, qrToken: randomToken(24) },
  });
}

export async function qrDataUrl(qrToken: string) {
  return QRCode.toDataURL(ticketVerifyUrl(qrToken), { margin: 1, width: 360, color: { dark: "#030B25", light: "#FFFFFF" } });
}

export const ticketInclude = {
  ticket: true,
  category: true,
  team: true,
  participants: { orderBy: { createdAt: "asc" } },
  payments: { where: { status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_PENDING"] } }, orderBy: { createdAt: "desc" }, take: 1 },
  tournament: { include: { venue: true, organiser: true } },
} satisfies Prisma.RegistrationInclude;

export type TicketRegistration = Prisma.RegistrationGetPayload<{ include: typeof ticketInclude }>;

async function loadLogo(): Promise<Uint8Array | null> {
  try {
    return await fs.readFile(path.join(process.cwd(), "public", "brand", "logo-wide-print.png"));
  } catch {
    try {
      const r = await fetch(`${env.appUrl}/brand/logo-wide-print.png`);
      return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
    } catch {
      return null;
    }
  }
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** pdf-lib standard fonts only support WinAnsi; strip anything else to avoid crashes on non-Latin names. */
function safe(s: string | null | undefined) {
  return (s ?? "").replace(/₹/g, "Rs. ").replace(/[^\x20-\x7E -ÿ]/g, "?");
}

export async function renderTicketPdf(registrationId: string): Promise<{ bytes: Uint8Array; filename: string } | null> {
  const reg = await db.registration.findUnique({ where: { id: registrationId }, include: ticketInclude });
  if (!reg?.ticket || reg.status !== "CONFIRMED") return null;
  const t = reg.tournament;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ticket ${reg.ticket.number} – ${t.name}`);
  pdf.setAuthor("TournamentHub");
  const page = pdf.addPage([595, 842]); // A4 portrait
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg_ = await pdf.embedFont(StandardFonts.Helvetica);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const navy = rgb(3 / 255, 11 / 255, 37 / 255);
  const blue = rgb(45 / 255, 90 / 255, 184 / 255);
  const orange = rgb(217 / 255, 120 / 255, 63 / 255);
  const muted = rgb(0.4, 0.44, 0.5);
  const green = rgb(47 / 255, 138 / 255, 91 / 255);
  const W = 595;

  // Header band
  page.drawRectangle({ x: 0, y: 842 - 150, width: W, height: 150, color: navy });
  page.drawRectangle({ x: 0, y: 842 - 156, width: W / 2, height: 6, color: blue });
  page.drawRectangle({ x: W / 2, y: 842 - 156, width: W / 2, height: 6, color: orange });
  const logoBytes = await loadLogo();
  if (logoBytes) {
    const logo = await pdf.embedPng(logoBytes);
    const h = 110;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: 30, y: 842 - 135, width: w, height: h });
  }
  page.drawText("OFFICIAL ENTRY TICKET", { x: W - 30 - bold.widthOfTextAtSize("OFFICIAL ENTRY TICKET", 11), y: 842 - 60, size: 11, font: bold, color: orange });
  page.drawText(safe(reg.ticket.number), { x: W - 30 - mono.widthOfTextAtSize(safe(reg.ticket.number), 13), y: 842 - 80, size: 13, font: mono, color: rgb(1, 1, 1) });

  let y = 842 - 200;
  const titleLines = wrap(safe(t.name), bold, 24, W - 60);
  for (const l of titleLines) {
    page.drawText(l, { x: 30, y, size: 24, font: bold, color: navy });
    y -= 30;
  }
  page.drawText(safe(reg.category.name).toUpperCase(), { x: 30, y: y + 4, size: 12, font: bold, color: blue });
  y -= 26;

  // QR code
  const qrPng = await QRCode.toBuffer(ticketVerifyUrl(reg.ticket.qrToken), { margin: 1, width: 400 });
  const qr = await pdf.embedPng(qrPng);
  const qrSize = 170;
  const qrX = W - 30 - qrSize;
  const qrY = y - qrSize + 10;
  page.drawRectangle({ x: qrX - 8, y: qrY - 8, width: qrSize + 16, height: qrSize + 16, borderColor: rgb(0.9, 0.91, 0.93), borderWidth: 1, color: rgb(1, 1, 1) });
  page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  page.drawText("Scan at the registration desk", { x: qrX + (qrSize - reg_.widthOfTextAtSize("Scan at the registration desk", 9)) / 2, y: qrY - 22, size: 9, font: reg_, color: muted });

  const field = (label: string, value: string, opts?: { mono?: boolean; color?: ReturnType<typeof rgb> }) => {
    page.drawText(label.toUpperCase(), { x: 30, y, size: 8, font: bold, color: muted });
    y -= 15;
    const lines = wrap(safe(value), opts?.mono ? mono : bold, 12, qrX - 60);
    for (const l of lines) {
      page.drawText(l, { x: 30, y, size: 12, font: opts?.mono ? mono : bold, color: opts?.color ?? navy });
      y -= 15;
    }
    y -= 9;
  };

  const players = reg.participants.map((p) => p.fullName).join("  &  ");
  if (reg.team) field("Team", reg.team.name);
  field(reg.participants.length > 1 ? "Players" : "Player", players);
  field("Registration ID", reg.code, { mono: true });
  const paid = reg.payments[0];
  field("Payment", reg.amount === 0 ? "No fee – confirmed" : `PAID  ${safe(formatMoney(reg.amount))}${paid?.providerPaymentId ? `  (${paid.providerPaymentId})` : ""}`, { color: green });
  field("Tournament date", `${formatDate(t.startDate, { weekday: "long" })}${t.matchStartTime ? `  ·  Matches from ${t.matchStartTime}` : ""}`);
  if (t.venue) field("Venue", `${t.venue.name}, ${t.venue.addressLine}, ${t.venue.city}`);

  y = Math.min(y, qrY - 50);
  // Instructions box
  const instr = safe(t.participantInstructions || DEFAULT_INSTRUCTIONS);
  const iLines = wrap(instr, reg_, 10.5, W - 90);
  const boxH = 34 + iLines.length * 14;
  page.drawRectangle({ x: 30, y: y - boxH, width: W - 60, height: boxH, color: rgb(1, 0.97, 0.93) });
  page.drawRectangle({ x: 30, y: y - boxH, width: 4, height: boxH, color: orange });
  page.drawText("IMPORTANT PARTICIPANT INSTRUCTIONS", { x: 45, y: y - 18, size: 9, font: bold, color: orange });
  let iy = y - 34;
  for (const l of iLines) {
    page.drawText(l, { x: 45, y: iy, size: 10.5, font: reg_, color: navy });
    iy -= 14;
  }
  y = y - boxH - 26;

  const directions = mapsLink(t.venue);
  if (directions) {
    page.drawText("Directions:", { x: 30, y, size: 9, font: bold, color: muted });
    drawLink(page, directions, 85, y, reg_, blue);
    y -= 16;
  }
  if (t.organiser) {
    page.drawText(safe(`Organiser: ${t.organiser.name}  ·  ${t.organiser.phone}  ·  ${t.organiser.email}`), { x: 30, y, size: 9, font: reg_, color: muted });
    y -= 16;
  }
  page.drawText(safe(`Verify: ${ticketVerifyUrl(reg.ticket.qrToken)}`), { x: 30, y, size: 7.5, font: reg_, color: muted });

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: W, height: 36, color: navy });
  page.drawText("TournamentHub  ·  Discover. Register. Compete.", { x: 30, y: 14, size: 9, font: bold, color: rgb(1, 1, 1) });
  const issued = `Issued ${formatDate(reg.ticket.issuedAt)}`;
  page.drawText(issued, { x: W - 30 - reg_.widthOfTextAtSize(issued, 9), y: 14, size: 9, font: reg_, color: rgb(0.8, 0.82, 0.86) });

  const bytes = await pdf.save();
  return { bytes, filename: `ticket-${reg.code}.pdf` };
}

function drawLink(page: PDFPage, url: string, x: number, y: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  const text = url.length > 90 ? `${url.slice(0, 87)}...` : url;
  page.drawText(safe(text), { x, y, size: 8.5, font, color });
}
