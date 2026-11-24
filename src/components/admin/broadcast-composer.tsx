"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageSquare, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import type { NotificationAudience } from "@prisma/client";
import { Button, Card, Field } from "@/components/ui";
import { sendBroadcastAction } from "@/server/actions/manage";
import { cn } from "@/lib/utils";

type T = { id: string; name: string; categories: { id: string; name: string }[]; entries: { id: string; label: string; isTeam: boolean }[] };

const TEMPLATES = [
  ["Schedule change", "Please note the updated match schedule. Check your match centre for your new timing and court."],
  ["Venue update", "There has been a change to the venue arrangements. Please read the details below carefully."],
  ["Match delays", "Matches are currently running behind schedule by approximately 30 minutes. Please stay close to the courts."],
  ["Important instructions", "Please carry your ticket and a valid photo ID. Non-marking shoes are mandatory on court."],
];

export function BroadcastComposer({ tournaments }: { tournaments: T[] }) {
  const router = useRouter();
  const [tid, setTid] = useState(tournaments[0]?.id ?? "");
  const [audience, setAudience] = useState<NotificationAudience>("ALL");
  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const t = tournaments.find((x) => x.id === tid);
  const entries = useMemo(() => (t?.entries ?? []).filter((e) => (audience === "TEAM" ? e.isTeam : true)).filter((e) => e.label.toLowerCase().includes(filter.toLowerCase())), [t, audience, filter]);

  if (!tournaments.length) return <Card className="p-6 text-sm text-muted">Publish a tournament to message its participants.</Card>;

  const send = () =>
    start(async () => {
      if (!confirm("Send this email now?")) return;
      const r = await sendBroadcastAction({ tournamentId: tid, audience, categoryId: audience === "CATEGORY" ? categoryId : undefined, registrationIds: audience === "TEAM" || audience === "SELECTED" ? selected : undefined, subject, body });
      if (r.ok) {
        toast.success(`Sent to ${r.data?.sent} of ${r.data?.recipients} recipients${r.data?.failed ? ` (${r.data.failed} failed — will retry)` : ""}.`);
        setSubject("");
        setBody("");
        setSelected([]);
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <Card className="p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <Field label="Tournament" htmlFor="b-t">
            <select id="b-t" className="input" value={tid} onChange={(e) => { setTid(e.target.value); setSelected([]); setCategoryId(""); }}>
              {tournaments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
          <div>
            <span className="label">Audience</span>
            <div className="grid grid-cols-2 gap-2">
              {([["ALL", "All participants"], ["CATEGORY", "A category"], ["TEAM", "Specific teams"], ["SELECTED", "Selected players"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => { setAudience(v); setSelected([]); }} className={cn("rounded-xl border-2 px-3 py-2 text-sm font-semibold", audience === v ? "border-brand bg-brand-50 text-brand" : "border-line text-muted hover:border-brand/40")}>{l}</button>
              ))}
            </div>
          </div>
          {audience === "CATEGORY" && (
            <Field label="Category" htmlFor="b-c">
              <select id="b-c" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Choose…</option>
                {t?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {(audience === "TEAM" || audience === "SELECTED") && (
            <div>
              <span className="label">{audience === "TEAM" ? "Teams" : "Entries"} ({selected.length} selected)</span>
              <input className="input mb-2" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
                {entries.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">
                    <input type="checkbox" className="size-4 accent-brand" checked={selected.includes(e.id)} onChange={(ev) => setSelected(ev.target.checked ? [...selected, e.id] : selected.filter((s) => s !== e.id))} />
                    {e.label}
                  </label>
                ))}
                {entries.length === 0 && <p className="px-2 py-3 text-sm text-subtle">No matching entries.</p>}
              </div>
            </div>
          )}
          <div>
            <span className="label">Channel</span>
            <div className="flex gap-2 text-sm">
              <span className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 font-semibold text-brand"><Mail className="size-4" /> Email</span>
              <span className="flex items-center gap-1.5 rounded-lg bg-canvas px-3 py-1.5 text-subtle" title="Coming soon"><Smartphone className="size-4" /> SMS</span>
              <span className="flex items-center gap-1.5 rounded-lg bg-canvas px-3 py-1.5 text-subtle" title="Coming soon"><MessageSquare className="size-4" /> WhatsApp</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map(([s, b]) => (
              <button key={s} type="button" onClick={() => { setSubject(s); setBody(b); }} className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-muted hover:bg-brand-50 hover:text-brand">{s}</button>
            ))}
          </div>
          <Field label="Subject" htmlFor="b-s"><input id="b-s" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} /></Field>
          <Field label="Message" htmlFor="b-m" hint="Plain text. Blank lines start new paragraphs."><textarea id="b-m" className="input" rows={9} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} /></Field>
          <div className="flex justify-end">
            <Button variant="accent" loading={pending} onClick={send} disabled={!subject.trim() || body.trim().length < 10 || (audience === "CATEGORY" && !categoryId) || ((audience === "TEAM" || audience === "SELECTED") && !selected.length)}>
              <Send className="size-4" /> Send email
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
