"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import { checkInAction } from "@/server/actions/manage";

export function CheckInButton({ ticketId, checkedIn }: { ticketId: string; checkedIn: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (undo: boolean) =>
    start(async () => {
      const r = await checkInAction(ticketId, undo);
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });
  return checkedIn ? (
    <Button variant="secondary" loading={pending} onClick={() => go(true)}><Undo2 className="size-4" /> Undo check-in</Button>
  ) : (
    <Button variant="success" size="lg" loading={pending} onClick={() => go(false)}><CheckCircle2 className="size-5" /> Check in</Button>
  );
}
