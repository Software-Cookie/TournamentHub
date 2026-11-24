import { db } from "@/lib/db";
import { requireManager } from "@/lib/authz";
import { PageHeader } from "@/components/ui";
import { TournamentForm } from "@/components/admin/tournament-form";

export const metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const user = await requireManager("/manage/tournaments/new");
  const [sports, org] = await Promise.all([
    db.sport.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true, listingFee: true } }),
    db.organisation.findFirst({ where: { members: { some: { userId: user.id } } }, select: { name: true, contactEmail: true, contactPhone: true, city: true } }),
  ]);
  return (
    <>
      <PageHeader title="Create a tournament" description="It's saved as a draft. Add categories, prizes and images next, then pay the listing fee and publish." />
      <TournamentForm
        id={null}
        sports={sports}
        values={{
          sportId: sports[0]?.id,
          matchStartTime: "08:00",
          organiserName: org?.name ?? "",
          organiserEmail: org?.contactEmail ?? "",
          organiserPhone: org?.contactPhone ?? "",
          venueCity: org?.city ?? "",
        }}
      />
    </>
  );
}
