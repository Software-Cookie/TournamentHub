"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Download, FileSpreadsheet, MailPlus, RotateCcw, Search, Users, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, Field, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/modal";
import { approveRegistrationAction, cancelRegistrationAction, refundPaymentAction, resendTicketAction } from "@/server/actions/manage";
import { formatDateTime, formatMoney } from "@/lib/utils";

export type AdminRegRow = {
  id: string;
  code: string;
  category: string;
  status: string;
  amount: number;
  createdAt: string;
  teamName: string | null;
  captain: string | null;
  account: string;
  adminNote: string | null;
  participants: { name: string; email: string | null; phone: string | null; dob: string | null; gender: string | null; city: string | null; emergency: string | null; skill: string | null }[];
  answers: Record<string, string | boolean>;
  ticket: { number: string; checkedInAt: string | null; revoked: boolean } | null;
  payments: { id: string; status: string; amount: number; refundedAmount: number; orderId: string; paymentId: string | null; method: string | null; paidAt: string | null; createdAt: string; failureReason: string | null; refunds: { amount: number; status: string; createdAt: string }[] }[];
};

export function RegistrationsTable({ tournamentId, rows, total, page, pageSize, categories }: { tournamentId: string; rows: AdminRegRow[]; total: number; page: number; pageSize: number; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [open, setOpen] = useState<AdminRegRow | null>(null);
  const [, start] = useTransition();
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    if (!("page" in patch)) n.delete("page");
    start(() => router.replace(`${pathname}?${n.toString()}`));
  };
  const exportQs = new URLSearchParams({ tournamentId, ...(sp.get("category") ? { categoryId: sp.get("category")! } : {}), ...(sp.get("status") ? { status: sp.get("status")! } : {}) });
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <form className="relative flex-1" onSubmit={(e) => { e.preventDefault(); set({ q }); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search player, email, phone, team or registration ID…" className="input pl-10" aria-label="Search registrations" />
        </form>
        <select value={sp.get("category") ?? ""} onChange={(e) => set({ category: e.target.value })} className="input lg:w-48" aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sp.get("status") ?? ""} onChange={(e) => set({ status: e.target.value })} className="input lg:w-48" aria-label="Status">
          <option value="">All (except expired)</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PENDING_APPROVAL">Awaiting approval</option>
          <option value="PENDING_PAYMENT">Payment pending</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired holds</option>
        </select>
        <div className="flex gap-2">
          <a href={`/api/manage/export?${exportQs}&format=csv`} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold hover:bg-canvas"><Download className="size-4" /> CSV</a>
          <a href={`/api/manage/export?${exportQs}&format=xlsx`} className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold hover:bg-canvas"><FileSpreadsheet className="size-4" /> Excel</a>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Users className="size-6" />} title="No registrations match">Try clearing filters.</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const pay = r.payments[0];
                  return (
                    <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer hover:bg-canvas/70">
                      <td className="px-4 py-3">
                        <p className="font-bold">{r.teamName ?? r.participants[0]?.name}</p>
                        {r.teamName && <p className="text-xs text-muted">{r.participants.map((p) => p.name).join(" & ")}</p>}
                        <p className="font-mono text-[0.7rem] text-subtle">{r.code}</p>
                      </td>
                      <td className="px-4 py-3">{r.category}</td>
                      <td className="px-4 py-3 text-xs text-muted">{r.participants[0]?.phone}<br />{r.participants[0]?.email}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3">{r.amount === 0 ? <Badge>Free</Badge> : pay ? <span className="flex items-center gap-2"><StatusBadge status={pay.status} /><span className="tabular-nums text-xs">{formatMoney(pay.amount)}</span></span> : <Badge tone="gray">No attempt</Badge>}</td>
                      <td className="px-4 py-3 text-xs text-muted">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-muted">{total} registration{total === 1 ? "" : "s"}</span>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })}>Previous</Button>
                <span className="text-muted">Page {page} of {pages}</span>
                <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })}>Next</Button>
              </div>
            )}
          </div>
        </Card>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? (open.teamName ?? open.participants[0]?.name ?? "Registration") : ""} description={open ? `${open.code} · ${open.category}` : undefined} size="lg">
        {open && <RegistrationDetail r={open} onDone={() => { setOpen(null); router.refresh(); }} />}
      </Modal>
    </>
  );
}

function RegistrationDetail({ r, onDone }: { r: AdminRegRow; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<null | "cancel" | "reject" | "refund">(null);
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(true);
  const [refundAmount, setRefundAmount] = useState("");
  const paid = r.payments.find((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED");
  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        onDone();
      } else toast.error(res.error);
    });

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} />
        <span className="text-muted">Account: {r.account}</span>
        {r.ticket && <Badge tone={r.ticket.revoked ? "red" : "blue"}>Ticket {r.ticket.number}{r.ticket.revoked ? " (revoked)" : ""}</Badge>}
        {r.ticket?.checkedInAt && <Badge tone="green">Checked in</Badge>}
      </div>
      {r.adminNote && <p className="rounded-lg bg-canvas px-3 py-2 text-muted">Note: {r.adminNote}</p>}
      {r.captain && <p><span className="font-semibold">Captain:</span> {r.captain}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {r.participants.map((p, i) => (
          <div key={i} className="rounded-xl border border-line p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-subtle">{r.participants.length > 1 ? `Player ${i + 1}` : "Player"}</p>
            <p className="mt-1 font-bold">{p.name}</p>
            <p className="text-muted">{p.email}</p>
            <p className="text-muted">{p.phone}</p>
            <p className="mt-1 text-xs text-subtle">DOB {p.dob ?? "—"}{p.gender ? ` · ${p.gender.toLowerCase()}` : ""}{p.city ? ` · ${p.city}` : ""}{p.skill ? ` · ${p.skill}` : ""}</p>
            {p.emergency && <p className="text-xs text-subtle">Emergency: {p.emergency}</p>}
          </div>
        ))}
      </div>
      {Object.keys(r.answers).length > 0 && (
        <div className="rounded-xl border border-line p-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-subtle">Answers</p>
          {Object.entries(r.answers).map(([k, v]) => <p key={k}><span className="text-muted">{k}:</span> {String(v)}</p>)}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-subtle">Transactions</p>
        {r.payments.length === 0 ? <p className="text-muted">No payment attempts.</p> : (
          <ul className="space-y-2">
            {r.payments.map((p) => (
              <li key={p.id} className="rounded-xl border border-line p-3 text-xs">
                <div className="flex items-center justify-between"><span className="text-sm font-bold">{formatMoney(p.amount)}</span><StatusBadge status={p.status} /></div>
                <p className="mt-1 font-mono text-muted">Order {p.orderId}{p.paymentId ? ` · Pay ${p.paymentId}` : ""}</p>
                <p className="text-muted">{p.method ? `${p.method.toUpperCase()} · ` : ""}{formatDateTime(p.paidAt ?? p.createdAt)}{p.refundedAmount ? ` · refunded ${formatMoney(p.refundedAmount)}` : ""}</p>
                {p.failureReason && <p className="text-danger">{p.failureReason}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {mode ? (
        <div className="space-y-3 rounded-2xl border border-line bg-canvas p-4">
          <Field label={mode === "refund" ? "Refund reason" : `Reason for ${mode === "reject" ? "rejection" : "cancellation"}`} required htmlFor="reason">
            <input id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shared with the player by email" />
          </Field>
          {mode === "refund" && paid && (
            <Field label="Amount (₹)" htmlFor="ramt" hint={`Leave empty for full refundable amount (${formatMoney(paid.amount - paid.refundedAmount)})`}>
              <input id="ramt" type="number" min={1} className="input" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            </Field>
          )}
          {mode !== "refund" && paid && (
            <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand" checked={refund} onChange={(e) => setRefund(e.target.checked)} /> Refund {formatMoney(paid.amount - paid.refundedAmount)} via Razorpay</label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                act(() =>
                  mode === "refund"
                    ? refundPaymentAction(paid!.id, { reason, amountRupees: refundAmount ? Number(refundAmount) : undefined })
                    : cancelRegistrationAction(r.id, { reason, refund: refund && !!paid, reject: mode === "reject" }),
                )
              }
            >
              Confirm {mode}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {r.status === "PENDING_APPROVAL" && (
            <>
              <Button variant="success" loading={pending} onClick={() => act(() => approveRegistrationAction(r.id))}><Check className="size-4" /> Approve</Button>
              <Button variant="secondary" onClick={() => setMode("reject")}><XCircle className="size-4" /> Reject</Button>
            </>
          )}
          {r.status === "CONFIRMED" && (
            <Button variant="secondary" loading={pending} onClick={() => act(() => resendTicketAction(r.id))}><MailPlus className="size-4" /> Resend ticket</Button>
          )}
          {["CONFIRMED", "PENDING_APPROVAL", "PENDING_PAYMENT"].includes(r.status) && (
            <Button variant="ghost" className="text-danger hover:bg-red-50" onClick={() => setMode("cancel")}><X className="size-4" /> Cancel registration</Button>
          )}
          {paid && (r.status === "CANCELLED" || r.status === "REJECTED" || r.status === "EXPIRED" || r.status === "CONFIRMED") && (
            <Button variant="ghost" onClick={() => setMode("refund")}><RotateCcw className="size-4" /> Refund</Button>
          )}
        </div>
      )}
    </div>
  );
}
