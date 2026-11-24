import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SportPricing } from "@/components/admin/sport-pricing";

export const metadata = { title: "Sports & pricing" };
export const dynamic = "force-dynamic";

export default async function SportsPage() {
  await requireAdmin();
  const [sports, stats] = await Promise.all([
    db.sport.findMany({ orderBy: { sortOrder: "asc" } }),
    db.listingFee.groupBy({ by: ["sportId"], where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
  ]);
  const by = new Map(stats.map((s) => [s.sportId, s]));
  return (
    <>
      <PageHeader title="Sports & pricing" description="Set the listing fee organisers pay per tournament, by sport. Changes apply to new checkouts immediately; already-paid listings are unaffected." />
      <SportPricing
        sports={sports.map((s) => ({ id: s.id, slug: s.slug, name: s.name, listingFee: s.listingFee, isActive: s.isActive, paidCount: by.get(s.id)?._count ?? 0, revenue: by.get(s.id)?._sum.amount ?? 0 }))}
      />
    </>
  );
}
