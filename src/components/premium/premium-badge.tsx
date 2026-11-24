import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Gold-on-navy badge for premium events and Premium members. */
export function PremiumBadge({ label = "Premium", className, size = "sm" }: { label?: string; className?: string; size?: "xs" | "sm" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-premium font-bold text-navy ring-1 ring-inset ring-premium-600/40 whitespace-nowrap",
        size === "xs" ? "px-1.5 py-px text-[0.65rem]" : "px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      <Crown className={size === "xs" ? "size-2.5" : "size-3.5"} aria-hidden />
      {label}
    </span>
  );
}
