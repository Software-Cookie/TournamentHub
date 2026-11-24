"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Archive, Eye, EyeOff, ImagePlus, Loader2, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { ImageKind } from "@prisma/client";
import { Badge, Button, Card, EmptyState, Field } from "@/components/ui";
import { Modal } from "@/components/modal";
import { ImageField, uploadFile } from "@/components/admin/image-upload";
import {
  addImageAction,
  deleteCategoryAction,
  deleteImageAction,
  deletePrizeAction,
  deleteSponsorAction,
  deleteTournamentAction,
  saveCategoryAction,
  savePrizeAction,
  saveQuestionsAction,
  saveSponsorAction,
  setTournamentStatusAction,
} from "@/server/actions/manage";
import type { ActionResult, CustomQuestion } from "@/lib/validation";
import { formatMoney } from "@/lib/utils";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return { pending, run };
}

// ─── Status ──────────────────────────────────────────────────

export function TournamentStatusControls({ id, status, hasRegistrations, canPublish = true }: { id: string; status: string; hasRegistrations: boolean; canPublish?: boolean }) {
  const { pending, run } = useRun();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <Button variant="success" loading={pending} disabled={!canPublish} title={canPublish ? undefined : "Pay the listing fee first"} onClick={() => run(() => setTournamentStatusAction(id, "PUBLISHED"))}>
          <Eye className="size-4" /> Publish
        </Button>
      )}
      {status === "PUBLISHED" && (
        <Button variant="secondary" loading={pending} onClick={() => confirm("Unpublish? The tournament will be hidden from the public.") && run(() => setTournamentStatusAction(id, "DRAFT"))}>
          <EyeOff className="size-4" /> Unpublish
        </Button>
      )}
      {(status === "PUBLISHED" || status === "ONGOING") && (
        <Button variant="secondary" loading={pending} onClick={() => confirm("Mark this tournament as completed?") && run(() => setTournamentStatusAction(id, "COMPLETED"))}>
          <Trophy className="size-4" /> Mark completed
        </Button>
      )}
      {status !== "ARCHIVED" ? (
        <Button variant="ghost" loading={pending} onClick={() => confirm("Archive this tournament? It will be hidden everywhere but all records are kept.") && run(() => setTournamentStatusAction(id, "ARCHIVED"))}>
          <Archive className="size-4" /> Archive
        </Button>
      ) : (
        <Button variant="secondary" loading={pending} onClick={() => run(() => setTournamentStatusAction(id, "DRAFT"))}>Restore as draft</Button>
      )}
      {!hasRegistrations && (
        <Button variant="ghost" className="text-danger hover:bg-red-50" loading={pending} onClick={() => confirm("Permanently delete this tournament? This cannot be undone.") && run(() => deleteTournamentAction(id), () => router.push("/manage/tournaments"))}>
          <Trash2 className="size-4" /> Delete
        </Button>
      )}
    </div>
  );
}

// ─── Categories ──────────────────────────────────────────────

export type AdminCategory = { id: string; code: string; name: string; teamSize: number; minTeamSize: number | null; genderRule: string; entryFee: number | null; maxEntries: number | null; minAge: number | null; maxAge: number | null; status: string; registrations: number; confirmed: number };

export function CategoryManager({ tournamentId, categories, defaultFee }: { tournamentId: string; categories: AdminCategory[]; defaultFee: number }) {
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);
  const { pending, run } = useRun();
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="font-extrabold">Competition categories</h2>
          <p className="text-xs text-subtle">Default fee {formatMoney(defaultFee)} unless overridden.</p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> Add category</Button>
      </div>
      {categories.length === 0 ? (
        <div className="p-6"><EmptyState title="No categories yet">Add at least one category before publishing.</EmptyState></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
              <tr><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5">Eligibility</th><th className="px-4 py-2.5">Fee</th><th className="px-4 py-2.5">Entries</th><th className="px-4 py-2.5">Status</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3"><p className="font-bold">{c.name}</p><p className="font-mono text-xs text-subtle">{c.code} · {c.teamSize === 1 ? "Singles" : c.teamSize === 2 ? "Pairs" : `Squad ${c.minTeamSize && c.minTeamSize < c.teamSize ? `${c.minTeamSize}–` : ""}${c.teamSize}`}</p></td>
                  <td className="px-4 py-3 text-muted">{c.genderRule.toLowerCase()}{c.minAge || c.maxAge ? ` · age ${c.minAge ?? "any"}–${c.maxAge ?? "any"}` : ""}</td>
                  <td className="px-4 py-3">{formatMoney(c.entryFee ?? defaultFee)}{c.entryFee == null && <span className="text-xs text-subtle"> (default)</span>}</td>
                  <td className="px-4 py-3 tabular-nums">{c.confirmed} confirmed / {c.maxEntries ?? "∞"}</td>
                  <td className="px-4 py-3"><Badge tone={c.status === "OPEN" ? "green" : "gray"}>{c.status.replace("_", " ").toLowerCase()}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(c)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink" aria-label={`Edit ${c.name}`}><Pencil className="size-4" /></button>
                      {c.registrations === 0 && (
                        <button disabled={pending} onClick={() => confirm(`Delete ${c.name}?`) && run(() => deleteCategoryAction(c.id))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-danger" aria-label={`Delete ${c.name}`}><Trash2 className="size-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add category" : "Edit category"}>
        {editing && <CategoryForm tournamentId={tournamentId} category={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function CategoryForm({ tournamentId, category, onDone }: { tournamentId: string; category: AdminCategory | null; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveCategoryAction.bind(null, tournamentId, category?.id ?? null), null as ActionResult<unknown> | null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      onDone();
    } else toast.error(state.error);
  }, [state, router, onDone]);
  const e = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const editable = !category || ["OPEN", "CLOSED"].includes(category.status);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" required htmlFor="c-name" error={e("name")} className="sm:col-span-2"><input id="c-name" name="name" defaultValue={category?.name} className="input" placeholder="Men's Doubles" /></Field>
      <Field label="Code" required htmlFor="c-code" error={e("code")} hint="Short code used in registration IDs"><input id="c-code" name="code" defaultValue={category?.code} className="input font-mono uppercase" maxLength={6} /></Field>
      <Field label="Players per entry (max squad)" required htmlFor="c-size" error={e("teamSize")}><input id="c-size" name="teamSize" type="number" min={1} max={15} defaultValue={category?.teamSize ?? 1} className="input" disabled={!!category && category.registrations > 0} /></Field>
      {category && category.registrations > 0 && <input type="hidden" name="teamSize" value={category.teamSize} />}
      <Field label="Minimum squad size" htmlFor="c-min-size" error={e("minTeamSize")} hint="Team sports only (3+ players). Leave empty to require a full squad.">
        <input id="c-min-size" name="minTeamSize" type="number" min={1} max={30} defaultValue={category?.minTeamSize ?? ""} className="input" />
      </Field>
      <Field label="Eligibility" htmlFor="c-gender">
        <select id="c-gender" name="genderRule" defaultValue={category?.genderRule ?? "OPEN"} className="input">
          <option value="OPEN">Open to all</option>
          <option value="MALE">Men only</option>
          <option value="FEMALE">Women only</option>
          <option value="MIXED">Mixed (men & women)</option>
        </select>
      </Field>
      <Field label="Entry fee (₹)" htmlFor="c-fee" hint="Leave empty to use the tournament default"><input id="c-fee" name="entryFee" type="number" min={0} defaultValue={category?.entryFee != null ? category.entryFee / 100 : ""} className="input" /></Field>
      <Field label="Maximum entries" htmlFor="c-max"><input id="c-max" name="maxEntries" type="number" min={2} defaultValue={category?.maxEntries ?? ""} className="input" /></Field>
      <Field label="Minimum age" htmlFor="c-min"><input id="c-min" name="minAge" type="number" min={4} max={99} defaultValue={category?.minAge ?? ""} className="input" /></Field>
      <Field label="Maximum age" htmlFor="c-maxage"><input id="c-maxage" name="maxAge" type="number" min={4} max={99} defaultValue={category?.maxAge ?? ""} className="input" /></Field>
      {editable && (
        <Field label="Registration" htmlFor="c-status" className="sm:col-span-2">
          <select id="c-status" name="status" defaultValue={category?.status === "CLOSED" ? "CLOSED" : "OPEN"} className="input">
            <option value="OPEN">Open for entries</option>
            <option value="CLOSED">Closed</option>
          </select>
        </Field>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={pending}>Save category</Button>
      </div>
    </form>
  );
}

// ─── Prizes ──────────────────────────────────────────────────

export type AdminPrize = { id: string; type: string; position: number; title: string; description: string | null; imageUrl: string | null; quantity: number; cashValue: number | null; categoryId: string | null };
const PRIZE_TYPES = [["CASH", "Cash prize"], ["TROPHY", "Trophy"], ["RACKET", "Badminton racket"], ["SPORTS_KIT", "Sports kit"], ["MEDAL", "Medal"], ["GIFT_VOUCHER", "Gift voucher"], ["CUSTOM", "Custom prize"]];

export function PrizeManager({ tournamentId, prizes, categories }: { tournamentId: string; prizes: AdminPrize[]; categories: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<AdminPrize | "new" | null>(null);
  const { pending, run } = useRun();
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="font-extrabold">Prizes</h2>
          <p className="text-xs text-subtle">Shown prominently on the tournament page. Cash values add up to the prize pool.</p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> Add prize</Button>
      </div>
      {prizes.length === 0 ? (
        <div className="p-6"><EmptyState icon={<Trophy className="size-6" />} title="No prizes yet">Players love knowing what they&apos;re competing for.</EmptyState></div>
      ) : (
        <ul className="divide-y divide-line">
          {prizes.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-5 py-3">
              {p.imageUrl ? <Image src={p.imageUrl} alt="" width={48} height={48} className="size-12 rounded-lg object-cover" /> : <div className="grid size-12 place-items-center rounded-lg bg-accent-50 font-extrabold text-accent">#{p.position}</div>}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{p.title}</p>
                <p className="text-xs text-subtle">
                  {PRIZE_TYPES.find((t) => t[0] === p.type)?.[1]} · position {p.position}{p.quantity > 1 ? ` · ×${p.quantity}` : ""}{p.cashValue ? ` · ${formatMoney(p.cashValue)}` : ""}
                  {p.categoryId ? ` · ${categories.find((c) => c.id === p.categoryId)?.name}` : " · all categories"}
                </p>
              </div>
              <button onClick={() => setEditing(p)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas" aria-label="Edit prize"><Pencil className="size-4" /></button>
              <button disabled={pending} onClick={() => confirm("Remove this prize?") && run(() => deletePrizeAction(p.id))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-danger" aria-label="Delete prize"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add prize" : "Edit prize"}>
        {editing && <PrizeForm tournamentId={tournamentId} prize={editing === "new" ? null : editing} categories={categories} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}

function PrizeForm({ tournamentId, prize, categories, onDone }: { tournamentId: string; prize: AdminPrize | null; categories: { id: string; name: string }[]; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(savePrizeAction.bind(null, tournamentId, prize?.id ?? null), null as ActionResult<unknown> | null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      router.refresh();
      onDone();
    } else toast.error(state.error);
  }, [state, router, onDone]);
  const e = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Prize type" htmlFor="p-type">
        <select id="p-type" name="type" defaultValue={prize?.type ?? "CASH"} className="input">{PRIZE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </Field>
      <Field label="Position" htmlFor="p-pos" error={e("position")}>
        <select id="p-pos" name="position" defaultValue={prize?.position ?? 1} className="input">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{["1st", "2nd", "3rd", "4th", "5th"][n - 1]} place</option>)}</select>
      </Field>
      <Field label="Prize title" required htmlFor="p-title" error={e("title")} className="sm:col-span-2"><input id="p-title" name="title" defaultValue={prize?.title} className="input" placeholder="Champion – ₹25,000 + Trophy" /></Field>
      <Field label="Description" htmlFor="p-desc" className="sm:col-span-2"><textarea id="p-desc" name="description" defaultValue={prize?.description ?? ""} rows={2} className="input" /></Field>
      <Field label="Cash value (₹)" htmlFor="p-cash" hint="Only for cash / voucher prizes"><input id="p-cash" name="cashValue" type="number" min={0} defaultValue={prize?.cashValue != null ? prize.cashValue / 100 : ""} className="input" /></Field>
      <Field label="Quantity" htmlFor="p-qty"><input id="p-qty" name="quantity" type="number" min={1} defaultValue={prize?.quantity ?? 1} className="input" /></Field>
      <Field label="Category" htmlFor="p-cat" className="sm:col-span-2">
        <select id="p-cat" name="categoryId" defaultValue={prize?.categoryId ?? ""} className="input"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </Field>
      <div className="sm:col-span-2"><ImageField name="imageUrl" label="Prize photo (optional)" defaultValue={prize?.imageUrl} aspect="aspect-[3/1]" folder="prizes" /></div>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={pending}>Save prize</Button>
      </div>
    </form>
  );
}

// ─── Media & sponsors ────────────────────────────────────────

const KINDS: [ImageKind, string][] = [["BANNER", "Banner"], ["COURT", "Court photo"], ["VENUE", "Venue photo"], ["ORGANISER_LOGO", "Organiser logo"], ["SPONSOR", "Sponsor logo"], ["PRIZE", "Prize photo"], ["GALLERY", "Gallery / highlight"]];

export function MediaManager({ tournamentId, images, sponsors }: { tournamentId: string; images: { id: string; url: string; kind: ImageKind; alt: string | null }[]; sponsors: { id: string; name: string; logoUrl: string | null; website: string | null }[] }) {
  const { pending, run } = useRun();
  const router = useRouter();
  const [kind, setKind] = useState<ImageKind>("COURT");
  const [uploading, setUploading] = useState(false);
  const [sponsor, setSponsor] = useState({ name: "", website: "", logoUrl: "" });
  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-extrabold">Tournament images</h2>
            <p className="text-xs text-subtle">Optimised and served responsively. Max 5 MB each.</p>
          </div>
          <div className="flex gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as ImageKind)} className="input h-10 w-auto py-0" aria-label="Image type">
              {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-700">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} Upload
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const files = [...(e.target.files ?? [])];
                  e.target.value = "";
                  if (!files.length) return;
                  setUploading(true);
                  try {
                    for (const f of files) {
                      const r = await uploadFile(f, "tournaments");
                      const saved = await addImageAction(tournamentId, { url: r.url, kind, publicId: r.publicId });
                      if (!saved.ok) throw new Error(saved.error);
                    }
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setUploading(false);
                    router.refresh();
                  }
                }}
              />
            </label>
          </div>
        </div>
        {images.length === 0 ? (
          <EmptyState icon={<ImagePlus className="size-6" />} title="No images yet">Add court and venue photos — they appear in the tournament gallery.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-canvas">
                <Image src={img.url} alt={img.alt ?? ""} fill sizes="240px" className="object-cover" />
                <Badge tone="dark" className="absolute left-2 top-2 bg-navy/80">{KINDS.find((k) => k[0] === img.kind)?.[1]}</Badge>
                <button disabled={pending} onClick={() => confirm("Remove image?") && run(() => deleteImageAction(img.id))} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-danger opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100" aria-label="Remove image">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-extrabold">Sponsors</h2>
        <ul className="mt-3 divide-y divide-line">
          {sponsors.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              {s.logoUrl ? <Image src={s.logoUrl} alt="" width={40} height={40} className="size-10 rounded-lg object-contain" /> : <div className="grid size-10 place-items-center rounded-lg bg-canvas text-sm font-bold">{s.name[0]}</div>}
              <span className="flex-1 truncate text-sm font-semibold">{s.name}</span>
              <button disabled={pending} onClick={() => run(() => deleteSponsorAction(s.id))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-danger" aria-label={`Remove ${s.name}`}><Trash2 className="size-4" /></button>
            </li>
          ))}
          {sponsors.length === 0 && <li className="py-3 text-sm text-subtle">No sponsors yet.</li>}
        </ul>
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <input className="input" placeholder="Sponsor name" value={sponsor.name} onChange={(e) => setSponsor({ ...sponsor, name: e.target.value })} />
          <input className="input" placeholder="Website (https://…)" value={sponsor.website} onChange={(e) => setSponsor({ ...sponsor, website: e.target.value })} />
          <SponsorLogo onUploaded={(url) => setSponsor((s) => ({ ...s, logoUrl: url }))} url={sponsor.logoUrl} />
          <Button size="sm" loading={pending} disabled={sponsor.name.trim().length < 2} onClick={() => run(() => saveSponsorAction(tournamentId, sponsor), () => setSponsor({ name: "", website: "", logoUrl: "" }))}>
            <Plus className="size-4" /> Add sponsor
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SponsorLogo({ url, onUploaded }: { url: string; onUploaded: (u: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted hover:border-brand">
      {url ? <Image src={url} alt="" width={32} height={32} className="size-8 rounded object-contain" /> : busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
      {url ? "Logo uploaded" : "Upload logo (optional)"}
      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setBusy(true);
        try { onUploaded((await uploadFile(f, "sponsors")).url); } catch (err) { toast.error(err instanceof Error ? err.message : "Upload failed"); } finally { setBusy(false); }
      }} />
    </label>
  );
}

// ─── Custom registration questions ───────────────────────────

export function QuestionsEditor({ tournamentId, initial }: { tournamentId: string; initial: CustomQuestion[] }) {
  const [qs, setQs] = useState<CustomQuestion[]>(initial);
  const { pending, run } = useRun();
  const update = (i: number, patch: Partial<CustomQuestion>) => setQs((q) => q.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  return (
    <Card className="p-5">
      <h2 className="font-extrabold">Additional registration questions</h2>
      <p className="mb-4 text-xs text-subtle">Asked once per registration (e.g. T-shirt size, club name, food preference).</p>
      <div className="space-y-3">
        {qs.map((q, i) => (
          <div key={q.id} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[1fr_150px_auto_auto]">
            <input className="input" value={q.label} placeholder="Question" onChange={(e) => update(i, { label: e.target.value })} aria-label="Question" />
            <select className="input" value={q.type} onChange={(e) => update(i, { type: e.target.value as CustomQuestion["type"] })} aria-label="Answer type">
              <option value="text">Short text</option>
              <option value="select">Dropdown</option>
              <option value="checkbox">Yes / no</option>
            </select>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-brand" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} /> Required</label>
            <button onClick={() => setQs(qs.filter((_, idx) => idx !== i))} className="grid size-10 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-danger" aria-label="Remove question"><Trash2 className="size-4" /></button>
            {q.type === "select" && (
              <input className="input sm:col-span-4" placeholder="Options, comma-separated (S, M, L, XL)" value={q.options?.join(", ") ?? ""} onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} aria-label="Options" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setQs([...qs, { id: `q${Date.now().toString(36)}`, label: "", type: "text", required: false }])}><Plus className="size-4" /> Add question</Button>
        <Button size="sm" loading={pending} onClick={() => run(() => saveQuestionsAction(tournamentId, qs.filter((q) => q.label.trim())))}>Save questions</Button>
      </div>
    </Card>
  );
}
