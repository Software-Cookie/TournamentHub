import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import Link from "next/link";
import { CalendarClock, CheckCircle2, CircleDollarSign, Clock3, CreditCard, ListChecks, Radio, RotateCcw, Trophy, Users, UsersRound, Wallet } from "lucide-react";
import { adminOverview } from "@/server/queries/admin";
import { ButtonLink, PageHeader, StatCard } from "@/components/ui";
import { CategoryChart, DailyRegistrationsChart, ParticipationChart, PaymentStatusChart, RevenueByTournamentChart } from "@/components/admin/charts";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [s, listing, premium, members] = await Promise.all([
    adminOverview(),
    db.listingFee.aggregate({ where: { status: "PAID" }, _sum: { amount: true, gstAmount: true }, _count: true }),
    db.premiumMembership.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
    db.user.count({ where: { premiumUntil: { gt: new Date() } } }),
  ]);
  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Live figures from the database — registrations, payments and matches across every tournament."
        actions={
          <>
            <ButtonLink href="/manage/matches" variant="secondary"><Radio className="size-4" /> Match control</ButtonLink>
            <ButtonLink href="/manage/tournaments/new" variant="accent">New tournament</ButtonLink>
          </>
        }
      />
      {s.registrations.pendingApproval > 0 && (
        <Link href="/manage/tournaments" className="mb-5 flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 hover:bg-violet-100">
          <ListChecks className="size-4" /> {s.registrations.pendingApproval} registration(s) awaiting your approval
        </Link>
      )}

      <section aria-label="Tournaments & players" className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total tournaments" value={s.tournaments.total} icon={<Trophy className="size-5" />} sub={`${s.tournaments.drafts} draft`} />
        <StatCard label="Active" value={s.tournaments.active} icon={<CalendarClock className="size-5" />} tone="orange" />
        <StatCard label="Completed" value={s.tournaments.completed} icon={<CheckCircle2 className="size-5" />} tone="green" />
        <StatCard label="Registrations" value={s.registrations.total} icon={<ListChecks className="size-5" />} tone="purple" sub={`${s.registrations.confirmed} confirmed`} />
        <StatCard label="Players" value={s.players} icon={<Users className="size-5" />} tone="blue" />
        <StatCard label="Teams" value={s.teams} icon={<UsersRound className="size-5" />} tone="gray" />
      </section>

      <section aria-label="Payments & matches" className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 2xl:grid-cols-7">
        <StatCard label="Listing fee revenue" value={formatMoney(listing._sum.amount ?? 0)} icon={<Wallet className="size-5" />} tone="orange" sub={`${listing._count} paid, incl. ${formatMoney(listing._sum.gstAmount ?? 0)} GST`} />
        <StatCard label="Premium revenue" value={formatMoney(premium._sum.amount ?? 0)} icon={<Wallet className="size-5" />} tone="purple" sub={`${members} active member(s)`} />
        <StatCard label="Gross collected" value={formatMoney(s.payments.gross)} icon={<CircleDollarSign className="size-5" />} tone="green" sub={`${s.payments.successful} successful payments`} />
        <StatCard label="Net revenue" value={formatMoney(s.payments.net)} icon={<Wallet className="size-5" />} tone="blue" sub={`after ${formatMoney(s.payments.refunded)} refunds & ${formatMoney(s.payments.fees)} fees`} />
        <StatCard label="Pending payments" value={s.payments.pending} icon={<Clock3 className="size-5" />} tone="orange" sub={`${s.payments.failed} failed`} />
        <StatCard label="Refunds" value={s.payments.refunds} icon={<RotateCcw className="size-5" />} tone="purple" sub={formatMoney(s.payments.refunded)} />
        <StatCard label="Upcoming matches" value={s.matches.upcoming} icon={<CreditCard className="size-5" />} tone="gray" />
        <StatCard label="Ongoing matches" value={s.matches.ongoing} icon={<Radio className="size-5" />} tone="red" sub={`${s.matches.completed} completed`} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <DailyRegistrationsChart data={s.charts.daily} />
        <RevenueByTournamentChart data={s.charts.revenueByTournament} />
        <CategoryChart data={s.charts.registrationsByCategory} />
        <PaymentStatusChart data={s.charts.paymentStatus} />
      </div>
      <div className="mt-6">
        <ParticipationChart data={s.charts.participation} />
      </div>
    </>
  );
}
