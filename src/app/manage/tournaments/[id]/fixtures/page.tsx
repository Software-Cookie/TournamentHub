import { requireTournamentManager } from "@/lib/authz";
import Link from "next/link";
import { ChevronRight, Crown, Users } from "lucide-react";
import { db } from "@/lib/db";
import { Card, EmptyState, StatusBadge } from "@/components/ui";
import { entryInclude, entryName } from "@/server/fixtures";

export const metadata = { title: "Fixtures" };
export const dynamic = "force-dynamic";

export default async function FixturesOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTournamentManager(id);
  const cats = await db.tournamentCategory.findMany({
    where: { tournamentId: id },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { registrations: { where: { status: "CONFIRMED" } } } } },
  });
  const matchStats = await db.match.groupBy({ by: ["categoryId", "status"], where: { tournamentId: id, isBye: false }, _count: true });
  const champs = await db.registration.findMany({ where: { id: { in: cats.map((c) => c.championId).filter(Boolean) as string[] } }, include: entryInclude });
  if (!cats.length) return <EmptyState title="No categories">Add categories in the Categories tab first.</EmptyState>;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cats.map((c) => {
        const ms = matchStats.filter((m) => m.categoryId === c.id);
        const total = ms.reduce((a, b) => a + b._count, 0);
        const done = ms.filter((m) => m.status === "COMPLETED").reduce((a, b) => a + b._count, 0);
        const live = ms.find((m) => m.status === "ONGOING")?._count ?? 0;
        const champ = champs.find((x) => x.id === c.championId);
        return (
          <Link key={c.id} href={`/manage/tournaments/${id}/fixtures/${c.id}`} className="group">
            <Card className="h-full p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold group-hover:text-brand">{c.name}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted"><Users className="size-4" /> {c._count.registrations} confirmed {c.teamSize > 1 ? "teams" : "players"}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              {total > 0 ? (
                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold text-muted"><span>{done}/{total} matches played</span>{live > 0 && <span className="text-danger">{live} live</span>}</div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${(done / total) * 100}%` }} /></div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-subtle">{c._count.registrations >= 2 ? "Ready to generate fixtures" : "Needs at least 2 confirmed entries"}</p>
              )}
              {champ && <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-amber-600"><Crown className="size-4" /> {entryName(champ)}</p>}
              <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand">Manage <ChevronRight className="size-4" /></p>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
