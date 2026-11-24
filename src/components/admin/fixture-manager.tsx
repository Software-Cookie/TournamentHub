"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Dices, GitBranch, ListOrdered, RefreshCw, Save, Shuffle, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/modal";
import { BracketView, type BracketRound } from "@/components/bracket/bracket-view";
import { MatchEditor, type EditableMatch } from "@/components/admin/match-editor";
import { generateFixturesAction, resetFixturesAction, saveManualDrawAction, setSeedsAction } from "@/server/actions/manage";
import { cn } from "@/lib/utils";
import type { DrawMode } from "@/lib/bracket";

type Entry = { id: string; code: string; name: string; team: string | null; p1: string; p2: string | null; seed: number | null; paymentStatus: string };

export function FixtureManager(props: {
  categoryId: string;
  categoryName: string;
  status: string;
  thirdPlace: boolean;
  isTeam: boolean;
  started: boolean;
  scoringHint: string;
  entries: Entry[];
  rounds: BracketRound[];
  championName: string | null;
  matches: EditableMatch[];
  firstRound: [string | null, string | null][];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<DrawMode>(props.entries.some((e) => e.seed) ? "SEEDED" : "RANDOM");
  const [third, setThird] = useState(props.thirdPlace);
  const [seeds, setSeedsState] = useState<Record<string, string>>(Object.fromEntries(props.entries.map((e) => [e.id, e.seed?.toString() ?? ""])));
  const [editing, setEditing] = useState<EditableMatch | null>(null);
  const [view, setView] = useState<"bracket" | "list">("bracket");
  const [drawOpen, setDrawOpen] = useState(false);
  const hasDraw = props.rounds.length > 0;

  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Done");
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });

  const nameOf = useMemo(() => new Map(props.entries.map((e) => [e.id, e.name])), [props.entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">{props.categoryName}</h2>
          <p className="text-sm text-muted">{props.entries.length} confirmed {props.isTeam ? "teams" : "players"} · <StatusBadge status={props.status} /></p>
        </div>
        {hasDraw && !props.started && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDrawOpen(true)}><ArrowLeftRight className="size-4" /> Edit matchups</Button>
            <Button variant="ghost" className="text-danger hover:bg-red-50" loading={pending} onClick={() => confirm("Clear the draw? All fixtures for this category will be removed.") && act(() => resetFixturesAction(props.categoryId))}><Trash2 className="size-4" /> Clear draw</Button>
          </div>
        )}
      </div>

      {/* Entries */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h3 className="font-extrabold">Confirmed entries</h3>
          {!props.started && props.entries.length > 0 && (
            <Button size="sm" variant="secondary" loading={pending} onClick={() => act(() => setSeedsAction(props.categoryId, Object.fromEntries(Object.entries(seeds).map(([k, v]) => [k, v ? parseInt(v, 10) : null]))))}>
              <Save className="size-4" /> Save seeds
            </Button>
          )}
        </div>
        {props.entries.length === 0 ? (
          <div className="p-5"><EmptyState title="No confirmed entries yet">Only confirmed (paid / approved) registrations enter the bracket.</EmptyState></div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
                <tr>
                  <th className="w-20 px-4 py-2.5">Seed</th>
                  {props.isTeam && <th className="px-4 py-2.5">Team</th>}
                  <th className="px-4 py-2.5">{props.isTeam ? "Player 1" : "Player"}</th>
                  {props.isTeam && <th className="px-4 py-2.5">Player 2</th>}
                  <th className="px-4 py-2.5">Registration</th>
                  <th className="px-4 py-2.5">Payment</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {props.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      <input type="number" min={1} max={64} disabled={props.started} value={seeds[e.id] ?? ""} onChange={(ev) => setSeedsState({ ...seeds, [e.id]: ev.target.value })} className="input h-9 w-16 px-2 py-1 text-center" aria-label={`Seed for ${e.name}`} />
                    </td>
                    {props.isTeam && <td className="px-4 py-2 font-bold">{e.team}</td>}
                    <td className={cn("px-4 py-2", !props.isTeam && "font-bold")}>{e.p1}</td>
                    {props.isTeam && <td className="px-4 py-2">{e.p2}</td>}
                    <td className="px-4 py-2 font-mono text-xs">{e.code}</td>
                    <td className="px-4 py-2">{e.paymentStatus === "FREE" ? <Badge>Free</Badge> : <StatusBadge status={e.paymentStatus} />}</td>
                    <td className="px-4 py-2"><Badge tone="green">Eligible</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Generate */}
      {!props.started && (
        <Card className="p-5">
          <h3 className="flex items-center gap-2 font-extrabold"><Sparkles className="size-4 text-accent" /> {hasDraw ? "Regenerate draw" : "Generate fixtures"}</h3>
          <p className="mt-1 text-sm text-muted">
            The bracket size is calculated automatically ({props.entries.length} entries → {props.entries.length >= 2 ? `${2 ** Math.ceil(Math.log2(props.entries.length))}-slot bracket with ${2 ** Math.ceil(Math.log2(props.entries.length)) - props.entries.length} BYE(s)` : "—"}). BYEs go to top seeds and are spread evenly.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {([
              ["RANDOM", "Random draw", "Shuffle all entries", Shuffle],
              ["SEEDED", "Seeded draw", "Seeds placed apart; rest random", ListOrdered],
              ["SEQUENTIAL", "Registration order", "1 v 2, 3 v 4 …", Dices],
            ] as const).map(([v, l, d, Icon]) => (
              <button key={v} onClick={() => setMode(v)} className={cn("rounded-xl border-2 p-3 text-left transition", mode === v ? "border-brand bg-brand-50/60" : "border-line hover:border-brand/40")}>
                <p className="flex items-center gap-2 font-bold"><Icon className="size-4" /> {l}</p>
                <p className="text-xs text-subtle">{d}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-brand" checked={third} onChange={(e) => setThird(e.target.checked)} /> Include third-place playoff</label>
            <Button
              variant="accent"
              loading={pending}
              disabled={props.entries.length < 2}
              onClick={() => (!hasDraw || confirm("Replace the current draw? Schedules and courts on existing fixtures will be lost.")) && act(() => generateFixturesAction(props.categoryId, { mode, thirdPlace: third }))}
            >
              {hasDraw ? <RefreshCw className="size-4" /> : <GitBranch className="size-4" />} {hasDraw ? "Regenerate" : "Generate fixtures"}
            </Button>
          </div>
        </Card>
      )}
      {props.started && <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-muted">Matches have started, so the draw is locked. Use match results and explicit corrections to make changes.</p>}

      {/* Bracket */}
      {hasDraw && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-extrabold">Bracket</h3>
            <div className="flex rounded-lg bg-canvas p-1 text-sm font-semibold">
              {(["bracket", "list"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={cn("rounded-md px-3 py-1", view === v ? "bg-white shadow-sm" : "text-muted")}>{v === "bracket" ? "Bracket" : "List"}</button>
              ))}
            </div>
          </div>
          {view === "bracket" ? (
            <>
              <BracketView rounds={props.rounds} championName={props.championName} onMatchClick={(bm) => setEditing(props.matches.find((m) => m.id === bm.id) ?? null)} />
              <p className="mt-2 text-xs text-subtle">Click a match to schedule it, change its status or record the result.</p>
            </>
          ) : (
            <div className="space-y-5">
              {[...new Set(props.matches.map((m) => m.roundName))].map((rn) => (
                <div key={rn}>
                  <p className="mb-2 text-sm font-bold">{rn}</p>
                  <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                    {props.matches.filter((m) => m.roundName === rn).map((m) => (
                      <li key={m.id}>
                        <button onClick={() => setEditing(m)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-canvas">
                          <span className="min-w-0 flex-1 truncate"><b>{m.a?.name ?? (m.isBye ? "BYE" : "TBD")}</b> vs <b>{m.b?.name ?? (m.isBye ? "BYE" : "TBD")}</b></span>
                          {m.score && <span className="font-mono text-xs">{m.score}</span>}
                          <span className="hidden text-xs text-subtle sm:inline">{m.court ?? ""}</span>
                          <StatusBadge status={m.isBye ? "COMPLETED" : m.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <MatchEditor match={editing} open={!!editing} onClose={() => setEditing(null)} scoringHint={props.scoringHint} />
      <Modal open={drawOpen} onClose={() => setDrawOpen(false)} title="Edit first-round matchups" description="Assign every confirmed entry exactly once. Leave a slot empty for a BYE." size="lg">
        {drawOpen && <ManualDraw categoryId={props.categoryId} initial={props.firstRound} entries={props.entries} nameOf={nameOf} onDone={() => { setDrawOpen(false); router.refresh(); }} />}
      </Modal>
    </div>
  );
}

function ManualDraw({ categoryId, initial, entries, nameOf, onDone }: { categoryId: string; initial: [string | null, string | null][]; entries: Entry[]; nameOf: Map<string, string>; onDone: () => void }) {
  const [pairs, setPairs] = useState(initial);
  const [pending, start] = useTransition();
  const used = new Set(pairs.flat().filter(Boolean) as string[]);
  const missing = entries.filter((e) => !used.has(e.id));
  const set = (i: number, slot: 0 | 1, v: string) =>
    setPairs((p) => {
      const next = p.map((x) => [...x] as [string | null, string | null]);
      // If the chosen entry is already placed elsewhere, swap it with this slot's current entry.
      const val = v || null;
      if (val) {
        for (let j = 0; j < next.length; j++)
          for (const s of [0, 1] as const) if (next[j]![s] === val && !(j === i && s === slot)) next[j]![s] = next[i]![slot];
      }
      next[i]![slot] = val;
      return next;
    });
  return (
    <div>
      <div className="space-y-2">
        {pairs.map((p, i) => (
          <div key={i} className="grid grid-cols-[2rem_1fr_auto_1fr] items-center gap-2">
            <span className="text-xs font-bold text-subtle">M{i + 1}</span>
            {[0, 1].map((s) => (
              <select key={s} value={p[s] ?? ""} onChange={(e) => set(i, s as 0 | 1, e.target.value)} className={cn("input h-10 py-0 text-sm", s === 1 && "order-4")} aria-label={`Match ${i + 1} slot ${s + 1}`}>
                <option value="">— BYE —</option>
                {entries.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            ))}
            <span className="order-3 text-xs font-bold text-subtle">vs</span>
          </div>
        ))}
      </div>
      {missing.length > 0 && <p className="mt-3 text-sm text-danger">Not placed: {missing.map((m) => nameOf.get(m.id)).join(", ")}</p>}
      {pairs.some(([a, b]) => !a && !b) && <p className="mt-1 text-sm text-danger">A match can&apos;t have two BYEs.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button
          loading={pending}
          disabled={missing.length > 0 || pairs.some(([a, b]) => !a && !b)}
          onClick={() =>
            start(async () => {
              const r = await saveManualDrawAction(categoryId, pairs);
              if (r.ok) {
                toast.success(r.message ?? "Saved");
                onDone();
              } else toast.error(r.error);
            })
          }
        >
          Save draw
        </Button>
      </div>
    </div>
  );
}
