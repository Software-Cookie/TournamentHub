import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { assertAdmin, assertCanManageTournament } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/http";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Neutralise spreadsheet formula injection (=, +, -, @, tab, CR). */
function cell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
function csvEscape(v: unknown) {
  const s = cell(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const rupees = (p: number | null | undefined) => (p == null ? "" : (p / 100).toFixed(2));
const ist = (d: Date | null | undefined) => (d ? new Date(d.getTime() + 5.5 * 3600_000).toISOString().replace("T", " ").slice(0, 16) : "");

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const tournamentId = sp.get("tournamentId") ?? undefined;
    // Organisers may export their own tournaments; the platform-wide export is admin-only.
    const admin = tournamentId ? await assertCanManageTournament(tournamentId) : await assertAdmin();
    if (!(await rateLimit(`export:${admin.id}`, 30, 600))) return NextResponse.json({ error: "Too many exports. Try again shortly." }, { status: 429 });
    const type = sp.get("type") === "payments" ? "payments" : "registrations";
    const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
    const t = tournamentId ? await db.tournament.findUnique({ where: { id: tournamentId }, select: { name: true } }) : null;

    let header: string[];
    let rows: unknown[][];
    if (type === "registrations") {
      if (!tournamentId) return NextResponse.json({ error: "tournamentId required" }, { status: 400 });
      const where: Prisma.RegistrationWhereInput = { tournamentId };
      if (sp.get("categoryId")) where.categoryId = sp.get("categoryId")!;
      const st = sp.get("status");
      if (st && ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "REJECTED", "CANCELLED", "EXPIRED"].includes(st)) where.status = st as never;
      else where.status = { not: "EXPIRED" };
      const regs = await db.registration.findMany({
        where,
        include: { category: true, team: true, participants: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "desc" }, take: 1 }, ticket: true },
        orderBy: [{ category: { sortOrder: "asc" } }, { createdAt: "asc" }],
      });
      header = ["Registration ID", "Category", "Status", "Team", "Captain", "Captain phone", "Player 1", "P1 email", "P1 phone", "P1 DOB", "P1 gender", "Player 2", "P2 email", "P2 phone", "P2 DOB", "P2 gender", "City", "Emergency contact", "Amount (INR)", "Payment status", "Payment ID", "Paid at (IST)", "Ticket", "Checked in", "Registered (IST)"];
      rows = regs.map((r) => {
        const [p1, p2] = r.participants;
        const pay = r.payments[0];
        return [
          r.code, r.category.name, r.status, r.team?.name ?? "", r.team?.captainName ?? "", r.team?.captainPhone ?? "",
          p1?.fullName ?? "", p1?.email ?? "", p1?.phone ?? "", p1?.dateOfBirth?.toISOString().slice(0, 10) ?? "", p1?.gender ?? "",
          p2?.fullName ?? "", p2?.email ?? "", p2?.phone ?? "", p2?.dateOfBirth?.toISOString().slice(0, 10) ?? "", p2?.gender ?? "",
          p1?.city ?? "", p1?.emergencyContactName ? `${p1.emergencyContactName} ${p1.emergencyContactPhone ?? ""}` : "",
          rupees(r.amount), r.amount === 0 ? "FREE" : (pay?.status ?? ""), pay?.providerPaymentId ?? "", ist(pay?.paidAt), r.ticket?.number ?? "", r.ticket?.checkedInAt ? "Yes" : "", ist(r.createdAt),
        ];
      });
    } else {
      const payments = await db.payment.findMany({
        where: tournamentId ? { tournamentId } : {},
        include: { registration: { select: { code: true, category: { select: { name: true } } } }, tournament: { select: { name: true } }, user: { select: { email: true } }, refunds: true },
        orderBy: { createdAt: "desc" },
        take: 20000,
      });
      header = ["Created (IST)", "Tournament", "Registration", "Category", "Account", "Order ID", "Payment ID", "Method", "Status", "Amount (INR)", "Gateway fee (INR)", "Refunded (INR)", "Net (INR)", "Paid at (IST)", "Failure reason"];
      rows = payments.map((p) => [
        ist(p.createdAt), p.tournament.name, p.registration.code, p.registration.category.name, p.user.email, p.providerOrderId, p.providerPaymentId ?? "", p.method ?? "", p.status,
        rupees(p.amount), rupees(p.fee), rupees(p.refundedAmount), ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_PENDING"].includes(p.status) ? rupees(p.amount - p.refundedAmount - (p.fee ?? 0)) : "0.00", ist(p.paidAt), p.failureReason ?? "",
      ]);
    }

    await audit({ actorId: admin.id, action: `export.${type}`, entityType: "Tournament", entityId: tournamentId ?? null, metadata: { format, rows: rows.length } });
    const base = `${slugify(t?.name ?? "all-tournaments")}-${type}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      const csv = "﻿" + [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"`, "Cache-Control": "no-store" } });
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = "TournamentHub";
    const ws = wb.addWorksheet(type === "registrations" ? "Registrations" : "Transactions");
    ws.addRow(header).font = { bold: true };
    for (const r of rows) ws.addRow(r.map(cell));
    ws.columns.forEach((c) => (c.width = 18));
    ws.views = [{ state: "frozen", ySplit: 1 }];
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}
