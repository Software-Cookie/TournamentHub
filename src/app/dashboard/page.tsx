import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, Clock, CreditCard, MapPin, Swords, Trophy, Wallet } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { myMatches, myRegistrations } from "@/server/queries/player";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";

export default async function DashboardOverview() {
  const user = await requireUser("/dashboard");
  const [regs, matches] = await Promise.all([myRegistrations(user), myMatches(user)]);
  const now = new Date();
  const active = regs.filter((r) => ["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT"].includes(r.status));
  const upcoming = active.filter((r) => r.tournament.startDate > now && r.tournament.status !== "COMPLETED");
  const completed = regs.filter((r) => r.status === "CONFIRMED" && r.tournament.status === "COMPLETED");
  const pending = regs.filter((r) => r.status === "PENDING_PAYMENT" && r.expiresAt && r.expiresAt > now);
  const nextMatch = matches.find((m) => m.status === "ONGOING") ?? matches.find((m) => !["COMPLETED", "CANCELLED"].includes(m.status) && m.opponent !== "To be decided");

  const activity = await db.auditLog.findMany({
    where: { OR: [{ actorId: user.id }, { entityType: "Registration", entityId: { in: regs.map((r) => r.id) } }, { entityType: "Payment", entityId: { in: (await db.payment.findMany({ where: { registrationId: { in: regs.map((r) => r.id) } }, select: { id: true } })).map((p) => p.id) } }] },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <>
      <PageHeader eyebrow="Overview" title={`Hi ${user.name?.split(" ")[0] ?? "there"} 👋`} description="Here's everything happening with your tournaments." actions={<ButtonLink href="/tournaments" variant="accent">Find a tournament</ButtonLink>} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tournaments registered" value={new Set(regs.filter((r) => r.status !== "EXPIRED").map((r) => r.tournamentId)).size} icon={<Trophy className="size-5" />} />
        <StatCard label="Upcoming" value={upcoming.length} icon={<CalendarCheck className="size-5" />} tone="orange" />
        <StatCard label="Completed" value={completed.length} icon={<CheckCircle2 className="size-5" />} tone="green" />
        <StatCard label="Pending payments" value={pending.length} icon={<Wallet className="size-5" />} tone={pending.length ? "red" : "gray"} sub={pending.length ? "Complete before your hold expires" : undefined} />
      </div>

      {pending.length > 0 && (
        <div className="mt-6 space-y-2">
          {pending.map((r) => (
            <Link key={r.id} href={`/dashboard/registrations/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm transition hover:bg-amber-100">
              <CreditCard className="size-5 shrink-0 text-amber-600" />
              <span className="min-w-0 flex-1">
                <span className="font-bold">Complete payment</span> for {r.category.name} · {r.tournament.name} — {formatMoney(r.amount)}
              </span>
              <ArrowRight className="size-4 text-amber-700" />
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-extrabold">Next match</h2>
            <Link href="/dashboard/matches" className="text-sm font-semibold text-brand hover:underline">Match centre</Link>
          </div>
          {nextMatch ? (
            <div className="relative overflow-hidden bg-navy p-6 text-white">
              <div className="court-pattern absolute inset-0 opacity-40" aria-hidden />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <StatusBadge status={nextMatch.status} />
                  <span className="text-xs text-white/60">{nextMatch.tournament.name} · {nextMatch.category} · {nextMatch.round}</span>
                </div>
                <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
                  <p className="display text-2xl italic sm:text-3xl">{nextMatch.myName}</p>
                  <span className="display text-xl text-accent">VS</span>
                  <p className="display text-2xl italic sm:text-3xl">{nextMatch.opponent}</p>
                </div>
                {nextMatch.liveScore && nextMatch.status === "ONGOING" && <p className="mt-3 text-center font-mono text-lg font-bold">{nextMatch.liveScore}</p>}
                <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/80">
                  <span className="flex items-center gap-1.5"><Clock className="size-4 text-accent" />{nextMatch.scheduledAt ? formatDateTime(nextMatch.scheduledAt) : "Time TBA"}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="size-4 text-accent" />{nextMatch.court ?? "Court TBA"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState icon={<Swords className="size-6" />} title="No upcoming matches">Fixtures appear here once the organiser publishes the draw.</EmptyState>
            </div>
          )}
        </Card>

        <Card>
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-extrabold">Recent activity</h2>
          </div>
          {activity.length ? (
            <ol className="space-y-0.5 p-3">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3 rounded-xl px-2 py-2.5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{ACTIVITY[a.action] ?? a.action.replace(/[._]/g, " ")}</p>
                    <p className="text-xs text-subtle">{formatDateTime(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="p-5 text-sm text-muted">Your registrations and payments will show up here.</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-extrabold">Upcoming tournaments</h2>
          <Link href="/dashboard/tournaments" className="text-sm font-semibold text-brand hover:underline">View all</Link>
        </div>
        {upcoming.length ? (
          <ul className="divide-y divide-line">
            {upcoming.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/registrations/${r.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-canvas">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-center leading-none text-brand">
                    <span className="text-lg font-extrabold">{formatDate(r.tournament.startDate, { day: "numeric" })}</span>
                    <span className="text-[0.6rem] font-bold uppercase">{formatDate(r.tournament.startDate, { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{r.tournament.name}</p>
                    <p className="truncate text-sm text-muted">{r.category.name}{r.team ? ` · ${r.team.name}` : ""}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-6">
            <EmptyState icon={<Trophy className="size-6" />} title="No upcoming tournaments" action={<ButtonLink href="/tournaments">Browse tournaments</ButtonLink>}>
              Find an event near you and lock in your slot.
            </EmptyState>
          </div>
        )}
      </Card>
      {regs.some((r) => r.status === "EXPIRED") && <p className="mt-4 text-xs text-subtle"><Badge tone="gray">Expired</Badge> entries were unpaid holds and don&apos;t count towards your totals.</p>}
    </>
  );
}

const ACTIVITY: Record<string, string> = {
  "registration.created": "Registration created",
  "payment.confirmed": "Payment confirmed — ticket issued",
  "payment.refund": "Refund initiated",
  "registration.approved": "Registration approved",
  "registration.cancelled": "Registration cancelled",
  "registration.rejected": "Registration declined",
  "user.signup": "Account created",
  "user.password_reset": "Password changed",
};
