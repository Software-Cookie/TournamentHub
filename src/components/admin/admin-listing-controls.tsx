"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { setFeaturedAction, setListingStatusAction } from "@/server/actions/admin";

/** Platform-admin shortcuts shown on any tournament's console page. */
export function AdminListingControls({ tournamentId, listingStatus, featured }: { tournamentId: string; listingStatus: string; featured: boolean }) {
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
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-xs">
      <span className="flex items-center gap-1 font-bold text-subtle"><Shield className="size-3.5" /> Platform admin</span>
      {listingStatus === "UNPAID" && (
        <button disabled={pending} onClick={() => go(() => setListingStatusAction(tournamentId, "WAIVED"))} className="rounded-lg px-2 py-1 font-semibold text-brand hover:bg-brand-50">Waive listing fee</button>
      )}
      {listingStatus === "WAIVED" && (
        <button disabled={pending} onClick={() => go(() => setListingStatusAction(tournamentId, "UNPAID"))} className="rounded-lg px-2 py-1 font-semibold text-brand hover:bg-brand-50">Remove waiver</button>
      )}
      <button disabled={pending} onClick={() => go(() => setFeaturedAction(tournamentId, !featured))} className="rounded-lg px-2 py-1 font-semibold text-brand hover:bg-brand-50">
        {featured ? "Remove from landing page" : "Feature on landing page"}
      </button>
    </div>
  );
}
