"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui";
import { Modal } from "@/components/modal";
import { recordPayoutAction, setOrganisationActiveAction } from "@/server/actions/admin";
import { formatMoney } from "@/lib/utils";

export function OrganiserRowActions({ organisationId, name, balance, active }: { organisationId: string; name: string; balance: number; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(balance > 0 ? String(balance / 100) : "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return (
    <div className="flex justify-end gap-1 text-xs font-semibold">
      <button onClick={() => setOpen(true)} className="rounded-lg px-2 py-1 text-brand hover:bg-brand-50">Record payout</button>
      <button
        disabled={pending}
        onClick={() => confirm(active ? `Suspend ${name}? Their published tournaments will be unpublished.` : `Reinstate ${name}?`) && go(() => setOrganisationActiveAction(organisationId, !active))}
        className={`rounded-lg px-2 py-1 ${active ? "text-danger hover:bg-red-50" : "text-success hover:bg-green-50"}`}
      >
        {active ? "Suspend" : "Reinstate"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Record payout to ${name}`} description={`Currently due: ${formatMoney(balance)}`} size="sm">
        <div className="space-y-4 text-left text-sm">
          <Field label="Amount (₹)" required htmlFor="po-amt"><input id="po-amt" type="number" min={1} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Transfer reference (UTR)" required htmlFor="po-ref"><input id="po-ref" className="input font-mono" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          <Field label="Note" htmlFor="po-note"><input id="po-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <p className="text-xs text-subtle">Record the transfer after you&apos;ve sent it from your bank or Razorpay account. This only updates the ledger.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={pending} disabled={!amount || !reference.trim()} onClick={() => go(() => recordPayoutAction({ organisationId, amountRupees: Number(amount), reference, note }), () => setOpen(false))}>Save payout</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
