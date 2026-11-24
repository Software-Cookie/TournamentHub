import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { isAdminRole, requireTournamentManager } from "@/lib/authz";
import { Badge, StatusBadge } from "@/components/ui";
import { SportIcon } from "@/components/sport-icon";
import { TournamentStatusControls } from "@/components/admin/tournament-managers";
import { TournamentTabs } from "@/components/admin/tournament-tabs";
import { ListingFeeBanner } from "@/components/organiser/listing-fee-banner";
import { AdminListingControls } from "@/components/admin/admin-listing-controls";
import { formatDate } from "@/lib/utils";

export default async function TournamentManageLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireTournamentManager(id);
  const t = await db.tournament.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, status: true, startDate: true, listingStatus: true, isFeatured: true, sport: { select: { slug: true, name: true, listingFee: true } }, _count: { select: { registrations: true } } },
  });
  if (!t) notFound();
  return (
    <>
      <Link href="/manage/tournaments" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All tournaments
      </Link>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-navy text-white"><SportIcon sport={t.sport.slug} className="size-6" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight">{t.name}</h1>
              <StatusBadge status={t.status} />
              {t.listingStatus === "WAIVED" && <Badge tone="gray">Listing waived</Badge>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
              {t.sport.name}, {formatDate(t.startDate, { weekday: "short" })}
              <Link href={`/tournaments/${t.slug}`} target="_blank" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
                Public page <ExternalLink className="size-3.5" />
              </Link>
            </p>
          </div>
        </div>
        <TournamentStatusControls id={t.id} status={t.status} hasRegistrations={t._count.registrations > 0} canPublish={t.listingStatus !== "UNPAID"} />
      </div>
      {t.listingStatus === "UNPAID" && <ListingFeeBanner tournamentId={t.id} sportName={t.sport.name} amount={t.sport.listingFee} />}
      {isAdminRole(user.role) && <AdminListingControls tournamentId={t.id} listingStatus={t.listingStatus} featured={t.isFeatured} />}
      <Suspense>
        <TournamentTabs id={t.id} />
      </Suspense>
      <div className="mt-6">{children}</div>
    </>
  );
}
