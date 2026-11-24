import Link from "next/link";
import { Clock, MapPin, Swords, Trophy } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { myMatches, type MyMatch } from "@/server/queries/player";
import { db } from "@/lib/db";
import { myRegistrationWhere } from "@/lib/authz";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Match centre" };
export const dynamic = "force-dynamic";

export default async function MatchCentrePage() {
  const user = await requireUser("/dashboard/matches");
  const matches = await myMatches(user);
  const ongoing = matches.filter((m) => m.status === "ONGOING");
  const upcoming = matches.filter((m) => !["ONGOING", "COMPLETED", "CANCELLED"].includes(m.status));
  const completed = matches.filter((m) => m.status === "COMPLETED").reverse();
  const tournaments = await db.tournament.findMany({
    where: { registrations: { some: { status: "CONFIRMED", ...(await myRegistrationWhere(user)) } }, categories: { some: { rounds: { some: {} } } } },
    select: { slug: true, name: true },
  });

  return (
    <>
      <PageHeader eyebrow="Match centre" title="Your matches" description="Opponents, courts, timings and results — updated as the organiser records them." />
      {tournaments.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {tournaments.map((t) => (
            <ButtonLink key={t.slug} href={`/tournaments/${t.slug}/fixtures`} variant="secondary" size="sm">
              <Swords className="size-4" /> {t.name} bracket
            </ButtonLink>
          ))}
        </div>
      )}
      {matches.length === 0 ? (
        <EmptyState icon={<Swords className="size-6" />} title="No matches yet" action={<ButtonLink href="/dashboard/tournaments">My tournaments</ButtonLink>}>
          Once the organiser generates fixtures for your category, your matches will appear here.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {ongoing.length > 0 && <Group title="Live now" items={ongoing} live />}
          <Group title="Upcoming" items={upcoming} empty="No upcoming matches right now." />
          <Group title="Completed" items={completed} empty="No completed matches yet." />
        </div>
      )}
    </>
  );
}

function Group({ title, items, empty, live }: { title: string; items: MyMatch[]; empty?: string; live?: boolean }) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
        {live && <span className="size-2.5 animate-pulse rounded-full bg-danger" />}
        {title} <span className="text-sm font-semibold text-subtle">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((m) => (
            <MatchCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({ m }: { m: MyMatch }) {
  return (
    <Card className={m.status === "ONGOING" ? "border-red-200 ring-2 ring-red-100" : ""}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-xs">
        <Link href={`/tournaments/${m.tournament.slug}/fixtures`} className="truncate font-semibold text-muted hover:text-brand">
          {m.tournament.name} · {m.category}
        </Link>
        <StatusBadge status={m.status} />
      </div>
      <div className="p-4">
        <p className="eyebrow text-[0.65rem] text-accent">{m.round}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-extrabold">{m.myName}</p>
            <p className="truncate text-sm text-muted">
              vs <span className="font-semibold text-ink">{m.opponent}</span>
              {m.opponentPlayers ? <span className="text-subtle"> ({m.opponentPlayers})</span> : null}
            </p>
          </div>
          {m.status === "COMPLETED" ? (
            <Badge tone={m.won ? "green" : "gray"} className="shrink-0">{m.won ? "Won" : "Lost"}</Badge>
          ) : null}
        </div>
        {(m.score || (m.status === "ONGOING" && m.liveScore)) && <p className="mt-2 font-mono text-lg font-bold">{m.score ?? m.liveScore}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5"><Clock className="size-4" />{m.scheduledAt ? formatDateTime(m.scheduledAt) : "Time TBA"}</span>
          <span className="flex items-center gap-1.5"><MapPin className="size-4" />{m.court ?? "Court TBA"}</span>
        </div>
        {m.status === "COMPLETED" && m.won && m.nextRound && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
            <Trophy className="size-4" /> Qualified for the {m.nextRound}
          </p>
        )}
        {m.status === "COMPLETED" && m.won && !m.nextRound && m.round === "Final" && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
            <Trophy className="size-4" /> Champion!
          </p>
        )}
        {m.notes && <p className="mt-2 text-xs text-subtle">Note: {m.notes}</p>}
      </div>
    </Card>
  );
}
