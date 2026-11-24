import Link from "next/link";
import { CalendarClock, CheckCircle2, CircleDollarSign, Clock3, ListChecks, Radio, Trophy, Users, Wallet } from "lucide-react";
import { manageScope, requireManager } from "@/lib/authz";
import { db } from "@/lib/db";
import { adminOverview } from "@/server/queries/admin";
import { ButtonLink, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { CategoryChart, DailyRegistrationsChart, PaymentStatusChart, RevenueByTournamentChart } from "@/components/admin/charts";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function ManageOverview() {
  const user = await requireManager();
  const scope = await manageScope(user);
  const [s, unpaidListings] = await Promise.all([adminOverview(scope), db.tournament.count({ where: { ...scope, listingStatus: "UNPAID", status: "DRAFT" } })]);

  if (s.tournaments.total === 0) {
    return (
      <>
        <PageHeader title={`Welcome, ${user.name?.split(" ")[0] ?? "organiser"}`} description="Set up your first tournament — it takes about five minutes." />
        <EmptyState icon={<Trophy className="size-6" />} title="No tournaments yet" action={<ButtonLink href="/manage/tournaments/new" variant="accent">Create a tournament</ButtonLink>}>
          Add the sport, categories, entry fees and venue. Publish after paying the listing fee and players can register straight away.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Overview"
        description="Live figures from your tournaments."
        actions={
          <>
            <ButtonLink href="/manage/matches" variant="secondary"><Radio className="size-4" /> Match control</ButtonLink>
            <ButtonLink href="/manage/tournaments/new" variant="accent">New tournament</ButtonLink>
          </>
        }
      />
      {(s.registrations.pendingApproval > 0 || unpaidListings > 0) && (
        <div className="mb-5 space-y-2">
          {s.registrations.pendingApproval > 0 && (
            <Link href="/manage/tournaments" className="flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 hover:bg-violet-100">
              <ListChecks className="size-4" /> {s.registrations.pendingApproval} registration(s) awaiting your approval
            </Link>
          )}
          {unpaidListings > 0 && (
            <Link href="/manage/tournaments" className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent-50 px-4 py-3 text-sm font-semibold text-accent-600 hover:bg-accent-100">
              <Wallet className="size-4" /> {unpaidListings} draft tournament(s) waiting for the listing fee before they can be published
            </Link>
          )}
        </div>
      )}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Tournaments" value={s.tournaments.total} icon={<Trophy className="size-5" />} sub={`${s.tournaments.active} active · ${s.tournaments.completed} completed`} />
        <StatCard label="Confirmed entries" value={s.registrations.confirmed} icon={<CheckCircle2 className="size-5" />} tone="green" sub={`${s.players} players · ${s.teams} teams`} />
        <StatCard label="Collected (net)" value={formatMoney(s.payments.net)} icon={<CircleDollarSign className="size-5" />} tone="blue" sub={`gross ${formatMoney(s.payments.gross)}`} />
        <StatCard label="Matches" value={s.matches.completed} icon={<CalendarClock className="size-5" />} tone="orange" sub={`${s.matches.ongoing} live · ${s.matches.upcoming} upcoming`} />
      </section>
      <section className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Registrations" value={s.registrations.total} icon={<ListChecks className="size-5" />} tone="purple" />
        <StatCard label="Pending payments" value={s.payments.pending} icon={<Clock3 className="size-5" />} tone="gray" sub={`${s.payments.failed} failed`} />
        <StatCard label="Refunds" value={formatMoney(s.payments.refunded)} icon={<Wallet className="size-5" />} tone="purple" sub={`${s.payments.refunds} refund(s)`} />
        <StatCard label="Players" value={s.players} icon={<Users className="size-5" />} tone="gray" />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DailyRegistrationsChart data={s.charts.daily} />
        <RevenueByTournamentChart data={s.charts.revenueByTournament} />
        <CategoryChart data={s.charts.registrationsByCategory} />
        <PaymentStatusChart data={s.charts.paymentStatus} />
      </div>
    </>
  );
}
