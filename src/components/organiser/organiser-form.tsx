"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Field } from "@/components/ui";
import { createOrganisationAction, updateOrganisationAction } from "@/server/actions/organiser";
import type { ActionResult } from "@/lib/validation";

type Values = { name?: string; contactEmail?: string; contactPhone?: string; city?: string; about?: string; payoutUpi?: string; payoutAccount?: string };

export function OrganiserForm({ mode, values }: { mode: "create" | "update"; values: Values }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(mode === "create" ? createOrganisationAction : updateOrganisationAction, null as ActionResult | null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message);
      if (mode === "create") router.push("/manage/tournaments/new");
      else router.refresh();
    } else toast.error(state.error);
  }, [state, mode, router]);
  const e = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Organisation or club name" required htmlFor="o-name" error={e("name")} className="sm:col-span-2">
        <input id="o-name" name="name" defaultValue={values.name} className="input" placeholder="Deccan Shuttlers Association" aria-invalid={!!e("name") || undefined} />
      </Field>
      <Field label="Contact email" required htmlFor="o-email" error={e("contactEmail")} hint="Shown to players for questions">
        <input id="o-email" name="contactEmail" type="email" defaultValue={values.contactEmail} className="input" aria-invalid={!!e("contactEmail") || undefined} />
      </Field>
      <Field label="Contact phone" required htmlFor="o-phone" error={e("contactPhone")}>
        <input id="o-phone" name="contactPhone" type="tel" inputMode="tel" defaultValue={values.contactPhone} className="input" aria-invalid={!!e("contactPhone") || undefined} />
      </Field>
      <Field label="City" required htmlFor="o-city" error={e("city")}>
        <input id="o-city" name="city" defaultValue={values.city} className="input" aria-invalid={!!e("city") || undefined} />
      </Field>
      <Field label="UPI ID for payouts" htmlFor="o-upi" hint="Where we settle entry fees collected for you">
        <input id="o-upi" name="payoutUpi" defaultValue={values.payoutUpi} className="input" placeholder="club@okaxis" />
      </Field>
      <Field label="Bank details (optional)" htmlFor="o-bank" className="sm:col-span-2" hint="Account name, number and IFSC — only if you prefer bank transfer">
        <input id="o-bank" name="payoutAccount" defaultValue={values.payoutAccount} className="input" />
      </Field>
      <Field label="About (optional)" htmlFor="o-about" className="sm:col-span-2">
        <textarea id="o-about" name="about" rows={3} defaultValue={values.about} className="input" maxLength={500} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant={mode === "create" ? "accent" : "primary"} size="lg" loading={pending} className="w-full sm:w-auto">
          {mode === "create" ? "Create organiser profile" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
