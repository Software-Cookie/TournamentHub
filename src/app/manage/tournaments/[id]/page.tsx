import { isAdminRole, requireTournamentManager } from "@/lib/authz";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { toIstInput } from "@/lib/dates";
import { parseCustomQuestions } from "@/lib/validation";
import { TournamentForm } from "@/components/admin/tournament-form";
import { CategoryManager, MediaManager, PrizeManager, QuestionsEditor } from "@/components/admin/tournament-managers";

export const metadata = { title: "Edit tournament" };
export const dynamic = "force-dynamic";

export default async function EditTournamentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab = "details" }] = await Promise.all([params, searchParams]);
  const user = await requireTournamentManager(id);
  const t = await db.tournament.findUnique({
    where: { id },
    include: {
      venue: true,
      organiser: true,
      categories: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { registrations: true } } } },
      prizes: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      images: { orderBy: [{ kind: "asc" }, { createdAt: "desc" }] },
      sponsors: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!t) notFound();

  if (tab === "categories") {
    const confirmed = await db.registration.groupBy({ by: ["categoryId"], where: { tournamentId: id, status: "CONFIRMED" }, _count: true });
    const cmap = new Map(confirmed.map((c) => [c.categoryId, c._count]));
    return (
      <CategoryManager
        tournamentId={t.id}
        defaultFee={t.entryFee}
        categories={t.categories.map((c) => ({ id: c.id, code: c.code, name: c.name, teamSize: c.teamSize, minTeamSize: c.minTeamSize, genderRule: c.genderRule, entryFee: c.entryFee, maxEntries: c.maxEntries, minAge: c.minAge, maxAge: c.maxAge, status: c.status, registrations: c._count.registrations, confirmed: cmap.get(c.id) ?? 0 }))}
      />
    );
  }
  if (tab === "prizes") return <PrizeManager tournamentId={t.id} prizes={t.prizes} categories={t.categories.map((c) => ({ id: c.id, name: c.name }))} />;
  if (tab === "media") return <MediaManager tournamentId={t.id} images={t.images} sponsors={t.sponsors} />;
  if (tab === "questions") return <QuestionsEditor tournamentId={t.id} initial={parseCustomQuestions(t.customQuestions)} />;

  const sports = await db.sport.findMany({ where: { OR: [{ isActive: true }, { id: t.sportId }] }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true, listingFee: true } });
  return (
    <TournamentForm
      id={t.id}
      sports={sports}
      canFeature={isAdminRole(user.role)}
      sportLocked={t.listingStatus === "PAID" && !isAdminRole(user.role)}
      values={{
        name: t.name,
        slug: t.slug,
        tagline: t.tagline ?? "",
        description: t.description,
        sportId: t.sportId,
        startDate: toIstInput(t.startDate),
        endDate: toIstInput(t.endDate),
        registrationOpensAt: toIstInput(t.registrationOpensAt),
        registrationClosesAt: toIstInput(t.registrationClosesAt),
        matchStartTime: t.matchStartTime ?? "",
        reportingMinutesBefore: t.reportingMinutesBefore,
        entryFee: t.entryFee / 100,
        maxParticipants: t.maxParticipants,
        requiresApproval: t.requiresApproval,
        allowMultipleCategories: t.allowMultipleCategories,
        isFeatured: t.isFeatured,
        rules: t.rules ?? "",
        terms: t.terms ?? "",
        refundPolicy: t.refundPolicy ?? "",
        participantInstructions: t.participantInstructions ?? undefined,
        reminderOffsetsHours: t.reminderOffsetsHours.join(","),
        emailSenderName: t.emailSenderName ?? "",
        emailReplyTo: t.emailReplyTo ?? "",
        bannerUrl: t.bannerUrl ?? "",
        venueName: t.venue?.name ?? "",
        venueAddress: t.venue?.addressLine ?? "",
        venueCity: t.venue?.city ?? "",
        venueState: t.venue?.state ?? "",
        venuePostal: t.venue?.postalCode ?? "",
        venueMapUrl: t.venue?.mapUrl ?? "",
        venueLat: t.venue?.latitude?.toString() ?? "",
        venueLng: t.venue?.longitude?.toString() ?? "",
        organiserName: t.organiser?.name ?? "",
        organiserEmail: t.organiser?.email ?? "",
        organiserPhone: t.organiser?.phone ?? "",
        organiserLogoUrl: t.organiser?.logoUrl ?? "",
      }}
    />
  );
}
