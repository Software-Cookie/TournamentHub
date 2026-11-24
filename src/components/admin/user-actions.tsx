"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setUserDisabledAction, setUserRoleAction } from "@/server/actions/admin";

export function UserActions({ userId, role, disabled, canChangeRole }: { userId: string; role: string; disabled: boolean; canChangeRole: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });
  return (
    <div className="flex justify-end gap-1 text-xs font-semibold">
      {canChangeRole && (
        <button disabled={pending} onClick={() => confirm(role === "ADMIN" ? "Remove admin access?" : "Grant full admin access to this user?") && go(() => setUserRoleAction(userId, role === "ADMIN" ? "PLAYER" : "ADMIN"))} className="rounded-lg px-2 py-1 text-brand hover:bg-brand-50">
          {role === "ADMIN" ? "Make player" : "Make admin"}
        </button>
      )}
      <button disabled={pending} onClick={() => confirm(disabled ? "Re-enable this account?" : "Disable this account? They'll be signed out.") && go(() => setUserDisabledAction(userId, !disabled))} className={`rounded-lg px-2 py-1 ${disabled ? "text-success hover:bg-green-50" : "text-danger hover:bg-red-50"}`}>
        {disabled ? "Enable" : "Disable"}
      </button>
    </div>
  );
}
