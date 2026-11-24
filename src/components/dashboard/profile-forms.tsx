"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button, Card, Field } from "@/components/ui";
import { changePasswordAction, updateProfileAction } from "@/server/actions/profile";
import type { ActionResult } from "@/lib/validation";

const fe = (s: ActionResult | null, k: string) => (s && !s.ok ? s.fieldErrors?.[k] : undefined);

function useToast(state: ActionResult | null) {
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Saved");
    else toast.error(state.error);
  }, [state]);
}

export function ProfileForms({ user, hasPassword, providers }: { user: { name: string; email: string; phone: string; city: string }; hasPassword: boolean; providers: string[] }) {
  const [pState, pAction, pPending] = useActionState(updateProfileAction, null);
  const [wState, wAction, wPending] = useActionState(changePasswordAction, null);
  useToast(pState);
  useToast(wState);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="mb-4 font-extrabold">Personal details</h2>
        <form action={pAction} className="space-y-4">
          <Field label="Full name" htmlFor="pf-name" error={fe(pState, "name")}>
            <input id="pf-name" name="name" defaultValue={user.name} className="input" required />
          </Field>
          <Field label="Email" htmlFor="pf-email" hint={providers.includes("google") ? "Linked with Google" : "Email can't be changed"}>
            <input id="pf-email" value={user.email} className="input bg-canvas" disabled />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="pf-phone" error={fe(pState, "phone")}>
              <input id="pf-phone" name="phone" type="tel" defaultValue={user.phone} className="input" />
            </Field>
            <Field label="City" htmlFor="pf-city">
              <input id="pf-city" name="city" defaultValue={user.city} className="input" />
            </Field>
          </div>
          <Button type="submit" loading={pPending}>Save changes</Button>
        </form>
      </Card>
      {hasPassword && (
        <Card className="p-6">
          <h2 className="mb-4 font-extrabold">Change password</h2>
          <form action={wAction} className="space-y-4">
            <Field label="Current password" htmlFor="pw-cur" error={fe(wState, "current")}>
              <input id="pw-cur" name="current" type="password" autoComplete="current-password" className="input" required />
            </Field>
            <Field label="New password" htmlFor="pw-new" error={fe(wState, "password")}>
              <input id="pw-new" name="password" type="password" autoComplete="new-password" className="input" required />
            </Field>
            <Field label="Confirm new password" htmlFor="pw-confirm" error={fe(wState, "confirm")}>
              <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" className="input" required />
            </Field>
            <Button type="submit" variant="secondary" loading={wPending}>Update password</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
