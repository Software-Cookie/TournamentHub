"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Check, Pause, Play, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { MatchStatus } from "@prisma/client";
import { Badge, Button, Field, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/modal";
import { recordResultAction, scheduleMatchAction, setMatchStatusAction } from "@/server/actions/manage";
import { cn } from "@/lib/utils";

export type EditableMatch = {
  id: string;
  version: number;
  status: MatchStatus;
  roundName: string;
  categoryName: string;
  tournamentName?: string;
  a: { id: string; name: string; sub?: string | null } | null;
  b: { id: string; name: string; sub?: string | null } | null;
  winnerId: string | null;
  court: string | null;
  scheduledAtInput: string; // IST "YYYY-MM-DDTHH:mm" or ""
  notes: string | null;
  liveScore: string | null;
  score: string | null;
  durationMinutes: number | null;
  remarks: string | null;
  isBye: boolean;
};

export function MatchEditor({ match, open, onClose, scoringHint = "21-18, 19-21, 21-15" }: { match: EditableMatch | null; open: boolean; onClose: () => void; scoringHint?: string }) {
  return (
    <Modal open={open} onClose={onClose} title={match ? `${match.roundName} · ${match.categoryName}` : ""} description={match?.tournamentName} size="lg">
      {match && <Editor key={`${match.id}:${match.version}`} m={match} onClose={onClose} scoringHint={scoringHint} />}
    </Modal>
  );
}

function Editor({ m, onClose, scoringHint }: { m: EditableMatch; onClose: () => void; scoringHint: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [court, setCourt] = useState(m.court ?? "");
  const [when, setWhen] = useState(m.scheduledAtInput);
  const [notes, setNotes] = useState(m.notes ?? "");
  const [notify, setNotify] = useState(true);
  const [live, setLive] = useState(m.liveScore ?? "");
  const [winner, setWinner] = useState(m.winnerId ?? "");
  const [score, setScore] = useState(m.score ?? "");
  const [duration, setDuration] = useState(m.durationMinutes?.toString() ?? "");
  const [remarks, setRemarks] = useState(m.remarks ?? "");
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState("");
  const completed = m.status === "COMPLETED";
  const both = !!m.a && !!m.b;

  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, close = false) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        router.refresh();
        if (close) onClose();
      } else toast.error(r.error);
    });

  if (m.isBye) return <p className="text-sm text-muted">{m.a?.name ?? m.b?.name} received a BYE and advanced automatically. BYE matches can&apos;t be edited.</p>;

  return (
    <div className="space-y-6">
      {/* Matchup */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-navy p-4 text-center text-white">
        {[m.a, m.b].map((s, i) => (
          <div key={i} className={cn("min-w-0", i === 1 && "order-3")}>
            <p className={cn("truncate font-extrabold", m.winnerId && s?.id === m.winnerId && "text-amber-300")}>{s?.name ?? "TBD"}</p>
            {s?.sub && <p className="truncate text-xs text-white/60">{s.sub}</p>}
          </div>
        ))}
        <div className="order-2 flex flex-col items-center gap-1">
          <span className="display text-xl text-accent">VS</span>
          <StatusBadge status={m.status} />
        </div>
      </div>

      {/* Status quick actions */}
      {!completed && (
        <section>
          <h3 className="mb-2 text-sm font-bold">Match status</h3>
          <div className="flex flex-wrap gap-2">
            {([
              ["UPCOMING", "Upcoming", CalendarClock],
              ["READY", "Ready / called", Check],
              ["ONGOING", "Start (live)", Play],
              ["POSTPONED", "Postpone", Pause],
              ["CANCELLED", "Cancel", XCircle],
            ] as const).map(([s, l, Icon]) => (
              <Button key={s} size="sm" variant={m.status === s ? "primary" : "secondary"} disabled={pending || m.status === s || ((s === "READY" || s === "ONGOING") && !both)} onClick={() => act(() => setMatchStatusAction(m.id, s))}>
                <Icon className="size-4" /> {l}
              </Button>
            ))}
          </div>
          {m.status === "ONGOING" && (
            <div className="mt-3 flex gap-2">
              <input className="input" value={live} onChange={(e) => setLive(e.target.value)} placeholder={`Live score, e.g. ${scoringHint.split(",")[0]}`} aria-label="Live score" />
              <Button variant="secondary" loading={pending} onClick={() => act(() => setMatchStatusAction(m.id, "ONGOING", live))}>Update</Button>
            </div>
          )}
        </section>
      )}

      {/* Schedule */}
      {!completed && m.status !== "CANCELLED" && (
        <section className="rounded-2xl border border-line p-4">
          <h3 className="mb-3 text-sm font-bold">Schedule & court</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date & time (IST)" htmlFor="m-when"><input id="m-when" type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
            <Field label="Court" htmlFor="m-court"><input id="m-court" className="input" value={court} onChange={(e) => setCourt(e.target.value)} placeholder="Court 3" /></Field>
            <Field label="Notes" htmlFor="m-notes" className="sm:col-span-2"><input id="m-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visible to players" /></Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email players about time changes</label>
            <Button size="sm" loading={pending} onClick={() => act(() => scheduleMatchAction(m.id, { court, scheduledAt: when, notes, notify }))}>Save schedule</Button>
          </div>
        </section>
      )}

      {/* Result */}
      {both && m.status !== "CANCELLED" && (!completed || correcting) && (
        <section className="rounded-2xl border-2 border-accent/30 bg-accent-50/40 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold"><Trophy className="size-4 text-accent" /> {correcting ? "Correct result" : "Record result"}</h3>
          {correcting && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Administrative correction. Changing the winner moves them in the next round — only possible while that match hasn&apos;t started. The change is logged permanently.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Winner">
            {[m.a!, m.b!].map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={winner === s.id} onClick={() => setWinner(s.id)} className={cn("rounded-xl border-2 px-3 py-3 text-left text-sm transition", winner === s.id ? "border-success bg-green-50" : "border-line bg-white hover:border-success/40")}>
                <span className="block truncate font-bold">{s.name}</span>
                <span className="text-xs text-subtle">{winner === s.id ? "Winner ✓" : "Select as winner"}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Final score" required htmlFor="m-score" hint="Or “Walkover” / “Retired”"><input id="m-score" className="input font-mono" value={score} onChange={(e) => setScore(e.target.value)} placeholder={scoringHint} /></Field>
            <Field label="Duration (min)" htmlFor="m-dur"><input id="m-dur" type="number" min={1} className="input" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
            <Field label="Remarks" htmlFor="m-rem" className="sm:col-span-2"><input id="m-rem" className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
            {correcting && <Field label="Reason for correction" required htmlFor="m-reason" className="sm:col-span-2"><input id="m-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {correcting && <Button variant="ghost" onClick={() => setCorrecting(false)}>Cancel</Button>}
            <Button
              variant="success"
              loading={pending}
              disabled={!winner || !score.trim()}
              onClick={() => {
                const winnerName = winner === m.a!.id ? m.a!.name : m.b!.name;
                if (!correcting && !confirm(`Confirm ${winnerName} as the winner? They will advance to the next round.`)) return;
                act(() => recordResultAction(m.id, { winnerId: winner, score, durationMinutes: duration ? Number(duration) : null, remarks: remarks || null, reason, version: m.version }, correcting), true);
              }}
            >
              <Check className="size-4" /> {correcting ? "Save correction" : "Complete match"}
            </Button>
          </div>
        </section>
      )}
      {completed && !correcting && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
          <div className="text-sm">
            <p className="font-bold">Result: <span className="font-mono">{m.score}</span></p>
            <p className="text-muted">Winner: {m.winnerId === m.a?.id ? m.a?.name : m.b?.name}{m.durationMinutes ? ` · ${m.durationMinutes} min` : ""}</p>
            {m.remarks && <p className="text-xs text-subtle">{m.remarks}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setCorrecting(true)}><AlertTriangle className="size-4" /> Correct result</Button>
        </section>
      )}
      {!both && <Badge tone="gray">Waiting for both entries to be decided by earlier rounds.</Badge>}
    </div>
  );
}
