import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { db } from "@/lib/db";
import { canViewTournamentMatches, myRegistrationWhere, requireUser } from "@/lib/authz";
import { categoryBracket } from "@/server/queries/bracket";
import { PageHero } from "@/components/site/page-hero";
import { CategoryBrackets } from "@/components/bracket/category-brackets";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Fixtures & bracket", robots: { index: false } };

export default async function FixturesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/tournaments/${slug}/fixtures`);
  const t = await db.tournament.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, status: true, categories: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } } });
  if (!t || t.status === "DRAFT") notFound();

  // Server-side authorisation — protected match data is never sent to non-participants.
  if (!(await canViewTournamentMatches(user, t.id))) {
    return (
      <>
        <PageHero eyebrow={t.name} title="Fixtures" compact />
        <div className="mx-auto max-w-3xl px-4 py-16">
          <EmptyState icon={<Lock className="size-6" />} title="Fixtures are for confirmed participants" action={<ButtonLink href={`/tournaments/${t.slug}`}>Back to tournament</ButtonLink>}>
            Match schedules and the bracket for this tournament are visible to players with a confirmed registration.
          </EmptyState>
        </div>
      </>
    );
  }

  const mine = await db.registration.findMany({ where: { tournamentId: t.id, ...(await myRegistrationWhere(user)) }, select: { id: true } });
  const categories = await Promise.all(
    t.categories.map(async (c) => {
      const b = await categoryBracket(c.id);
      return { id: c.id, name: c.name, rounds: b.rounds, championName: b.championName };
    }),
  );

  return (
    <>
      <PageHero eyebrow={t.name} title="Fixtures & bracket" compact>
        Follow every round from the first serve to the final.
      </PageHero>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <CategoryBrackets categories={categories} highlightIds={mine.map((m) => m.id)} />
      </div>
    </>
  );
}
