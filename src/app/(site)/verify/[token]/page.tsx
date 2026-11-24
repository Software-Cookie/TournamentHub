import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ShieldAlert, ShieldX } from "lucide-react";
import { db } from "@/lib/db";
import { canManageTournament, getCurrentUser, getMemberOrgIds, isAdminRole } from "@/lib/authz";
import { rateLimitByIp } from "@/lib/rate-limit";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { CheckInButton } from "@/components/admin/check-in-button";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Ticket verification", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function VerifyTicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw).trim();
  const user = await getCurrentUser();
  const isManager = !!user && (isAdminRole(user.role) || (await getMemberOrgIds(user.id)).length > 0);

  if (!isManager && !(await rateLimitByIp("verify-ticket", 30, 600))) {
    return <Shell><Result tone="warn" title="Too many lookups" body="Please wait a few minutes and try again." /></Shell>;
  }
  // QR tokens are unguessable secrets. Ticket numbers are only accepted from organisers (admins).
  const ticket = await db.ticket.findFirst({
    where: isManager && /^TKT-/i.test(token) ? { number: token.toUpperCase() } : { qrToken: token },
    include: {
      registration: {
        include: { tournament: { select: { name: true, startDate: true, slug: true } }, category: { select: { name: true } }, team: true, participants: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!ticket) return <Shell><Result tone="bad" title="Ticket not found" body="This QR code doesn't match any TournamentHub ticket. It may be forged or mistyped." /></Shell>;
  const reg = ticket.registration;
  // Full participant details and check-in only for people who manage this tournament.
  const admin = !!user && (await canManageTournament(user, reg.tournamentId));
  if (!admin && /^TKT-/i.test(token)) return <Shell><Result tone="bad" title="Ticket not found" body="This ticket number doesn&apos;t belong to one of your tournaments." /></Shell>;
  const valid = !ticket.revokedAt && reg.status === "CONFIRMED";

  return (
    <Shell>
      {valid ? (
        <Result tone="good" title={ticket.checkedInAt ? "Valid ticket — already checked in" : "Valid ticket"} body={`${reg.tournament.name} · ${reg.category.name}`} />
      ) : (
        <Result tone="bad" title="Ticket not valid" body={reg.status === "CANCELLED" || reg.status === "REJECTED" ? "This registration was cancelled." : "This ticket has been revoked."} />
      )}
      {admin ? (
        <Card className="mt-5 p-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Ticket" value={ticket.number} mono />
            <Item label="Registration" value={reg.code} mono />
            <Item label="Tournament" value={`${reg.tournament.name} (${formatDate(reg.tournament.startDate)})`} />
            <Item label="Category" value={reg.category.name} />
            {reg.team && <Item label="Team" value={reg.team.name} />}
            <Item label={reg.participants.length > 1 ? "Players" : "Player"} value={reg.participants.map((p) => `${p.fullName} (${p.phone})`).join(", ")} />
            <Item label="Status" value={reg.status} />
            <Item label="Checked in" value={ticket.checkedInAt ? formatDateTime(ticket.checkedInAt) : "Not yet"} />
          </dl>
          {valid && (
            <div className="mt-6 flex flex-wrap gap-2">
              <CheckInButton ticketId={ticket.id} checkedIn={!!ticket.checkedInAt} />
              <ButtonLink href="/manage/scan" variant="secondary">Scan next</ButtonLink>
            </div>
          )}
        </Card>
      ) : (
        <p className="mt-5 text-center text-sm text-muted">
          Organisers: <Link href={`/login?callbackUrl=/verify/${encodeURIComponent(token)}`} className="font-semibold text-brand">sign in</Link> to see participant details and check in.
        </p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-xl px-4 pb-20 pt-28">{children}</div>;
}

function Result({ tone, title, body }: { tone: "good" | "bad" | "warn"; title: string; body: string }) {
  const Icon = tone === "good" ? BadgeCheck : tone === "bad" ? ShieldX : ShieldAlert;
  const cls = tone === "good" ? "bg-green-50 text-success ring-green-200" : tone === "bad" ? "bg-red-50 text-danger ring-red-200" : "bg-amber-50 text-amber-700 ring-amber-200";
  return (
    <div className={`rounded-3xl p-8 text-center ring-1 ${cls}`}>
      <Icon className="mx-auto size-16" />
      <h1 className="mt-4 text-2xl font-extrabold text-ink">{title}</h1>
      <p className="mt-1 text-muted">{body}</p>
      {tone === "good" && <Badge tone="green" className="mt-3">Verified by TournamentHub</Badge>}
    </div>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className={`mt-0.5 font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
