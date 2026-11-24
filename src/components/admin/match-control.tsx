"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlarmClock, CheckCircle2, Clock, MapPin, Play, Radio, Swords } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, EmptyState, StatusBadge } from "@/components/ui";
import { MatchEditor, type EditableMatch } from "@/components/admin/match-editor";
import { setMatchStatusAction } from "@/server/actions/manage";
import { formatDateTime, formatTime } from "@/lib/utils";

export type ControlMatch = EditableMatch & { scheduledAt: string | null; completedAt: string | null };

export function MatchControl({ tournaments, tournamentId, matches }: { tournaments: { id: string; name: string }[]; tournamentId: string | null; matches: ControlMatch[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState<ControlMatch | null>(null);
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => {
      if (!document.hidden && !editing) router.refresh();
      setNow(Date.now());
    }, 20_000);
    return () => clearInterval(i);
  }, [router, editing]);

  const list = useMemo(() => matches.filter((m) => !category || m.categoryName === category), [matches, category]);
  const live = list.filter((m) => m.status === "ONGOING");
  const awaiting = list.filter((m) => m.status !== "ONGOING" && m.status !== "COMPLETED" && m.status !== "CANCELLED" && m.a && m.b && m.scheduledAt && new Date(m.scheduledAt).getTime() < now - 5 * 60_000);
  const upcoming = list.filter((m) => !["ONGOING", "COMPLETED", "CANCELLED"].includes(m.status) && m.a && m.b && !awaiting.includes(m));
  const waiting = list.filter((m) => !["COMPLETED", "CANCELLED"].includes(m.status) && (!m.a || !m.b));
  const completed = list.filter((m) => m.status === "COMPLETED").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 12);
  const courts = [...new Set(list.map((m) => m.court).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const categories = [...new Set(matches.map((m) => m.categoryName))];

  const quick = (m: ControlMatch, status: "ONGOING" | "READY") =>
    start(async () => {
      const r = await setMatchStatusAction(m.id, status);
      if (r.ok) {
        toast.success(status === "ONGOING" ? "Match started" : "Players called");
        router.refresh();
      } else toast.error(r.error);
    });

  if (!tournamentId) return <EmptyState icon={<Swords className="size-6" />} title="No fixtures yet">Generate fixtures for a tournament to start running matches.</EmptyState>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <select value={tournamentId} onChange={(e) => router.push(`${pathname}?t=${e.target.value}`)} className="input sm:w-80" aria-label="Tournament">
          {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input sm:w-56" aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Court board */}
      {courts.length > 0 && (
        <section>
          <h2 className="mb-3 font-extrabold">Courts</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {courts.map((c) => {
              const onCourt = live.find((m) => m.court === c);
              const next = upcoming.concat(awaiting).filter((m) => m.court === c).sort((a, b) => (a.scheduledAt ?? "z").localeCompare(b.scheduledAt ?? "z"))[0];
              return (
                <button key={c} onClick={() => (onCourt ?? next) && setEditing((onCourt ?? next)!)} className={`rounded-2xl border p-3 text-left transition hover:shadow-md ${onCourt ? "border-red-200 bg-red-50" : "border-line bg-white"}`}>
                  <p className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-subtle">{c} {onCourt ? <span className="flex items-center gap-1 text-danger"><span className="size-1.5 animate-pulse rounded-full bg-danger" />Live</span> : <span>Free</span>}</p>
                  {onCourt ? (
                    <>
                      <p className="mt-1 truncate text-sm font-bold">{onCourt.a?.name}</p>
                      <p className="truncate text-sm font-bold">{onCourt.b?.name}</p>
                      {onCourt.liveScore && <p className="mt-1 font-mono text-xs">{onCourt.liveScore}</p>}
                    </>
                  ) : next ? (
                    <p className="mt-1 text-xs text-muted">Next: {next.a?.name} vs {next.b?.name}{next.scheduledAt ? ` · ${formatTime(next.scheduledAt)}` : ""}</p>
                  ) : (
                    <p className="mt-1 text-xs text-subtle">No matches queued</p>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Queue title="Live now" icon={<Radio className="size-4 text-danger" />} items={live} onOpen={setEditing} empty="No matches in progress." />
        <Queue title="Awaiting results" icon={<AlarmClock className="size-4 text-warning" />} items={awaiting} onOpen={setEditing} empty="Nothing overdue." action={(m) => <Button size="sm" variant="secondary" disabled={pending} onClick={(e) => { e.stopPropagation(); quick(m, "ONGOING"); }}><Play className="size-3.5" /> Start</Button>} />
        <Queue title="Upcoming & ready" icon={<Clock className="size-4 text-brand" />} items={upcoming} onOpen={setEditing} empty="No upcoming matches with both entries." action={(m) => m.status === "READY" ? <Button size="sm" disabled={pending} onClick={(e) => { e.stopPropagation(); quick(m, "ONGOING"); }}><Play className="size-3.5" /> Start</Button> : <Button size="sm" variant="secondary" disabled={pending} onClick={(e) => { e.stopPropagation(); quick(m, "READY"); }}>Call players</Button>} />
        <Queue title="Recently completed" icon={<CheckCircle2 className="size-4 text-success" />} items={completed} onOpen={setEditing} empty="No completed matches yet." />
      </div>
      {waiting.length > 0 && <p className="text-sm text-subtle">{waiting.length} later-round match(es) are waiting for earlier results.</p>}

      <MatchEditor match={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function Queue({ title, icon, items, onOpen, empty, action }: { title: string; icon: React.ReactNode; items: ControlMatch[]; onOpen: (m: ControlMatch) => void; empty: string; action?: (m: ControlMatch) => React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-5 py-3 font-extrabold">{icon} {title} <span className="text-sm font-semibold text-subtle">({items.length})</span></h2>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-subtle">{empty}</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
          {items.map((m) => (
            <li key={m.id}>
              <div role="button" tabIndex={0} onClick={() => onOpen(m)} onKeyDown={(e) => e.key === "Enter" && onOpen(m)} className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-canvas">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm"><b>{m.a?.name}</b> <span className="text-subtle">vs</span> <b>{m.b?.name}</b></p>
                  <p className="flex flex-wrap gap-x-3 text-xs text-subtle">
                    <span>{m.categoryName} · {m.roundName}</span>
                    {m.court && <span className="flex items-center gap-1"><MapPin className="size-3" />{m.court}</span>}
                    {m.scheduledAt && m.status !== "COMPLETED" && <span>{formatDateTime(m.scheduledAt)}</span>}
                    {(m.score || m.liveScore) && <span className="font-mono text-ink">{m.score ?? m.liveScore}</span>}
                  </p>
                </div>
                <StatusBadge status={m.status} />
                {action?.(m)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
