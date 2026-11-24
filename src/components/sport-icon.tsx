import { cn } from "@/lib/utils";

/** Line icons for each sport (24×24, stroke = currentColor). */
const PATHS: Record<string, React.ReactNode> = {
  badminton: (
    <>
      <path d="M14 10 20.5 3.5" />
      <path d="M17 3.2 20.8 7" />
      <path d="M15.4 4.6 19.4 8.6" />
      <circle cx="11.5" cy="12.5" r="2.5" />
      <path d="M9.7 14.3 4 20" />
      <path d="m5.5 18.5 1 1" />
    </>
  ),
  cricket: (
    <>
      <path d="m14 4 6 6-9.5 9.5a2.1 2.1 0 0 1-3-3L14 4Z" />
      <path d="m7.5 16.5-4 4" />
      <circle cx="18.5" cy="18.5" r="2" />
    </>
  ),
  football: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7.5 3.5 2.5-1.3 4h-4.4L8.5 10 12 7.5Z" />
      <path d="M12 3v4.5M15.5 10l4.6-1.5M14.2 14l2.8 4M9.8 14 7 18M8.5 10 3.9 8.5" />
    </>
  ),
  tennis: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6a9 9 0 0 1 0 12.8" />
      <path d="M18.4 5.6a9 9 0 0 0 0 12.8" />
    </>
  ),
  volleyball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a12 12 0 0 1 3.5 9" />
      <path d="M3.8 8.5A12 12 0 0 1 12 12l4.5 7.5" />
      <path d="M12 12a12 12 0 0 1-8.6 1.6" />
      <path d="M15.5 12a12 12 0 0 0 5.4-1.4" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18" />
      <path d="M5.6 5.6a9 9 0 0 1 2.6 6.4 9 9 0 0 1-2.6 6.4" />
      <path d="M18.4 5.6a9 9 0 0 0-2.6 6.4 9 9 0 0 0 2.6 6.4" />
    </>
  ),
  "table-tennis": (
    <>
      <path d="M15.5 13.5a6 6 0 1 0-5-5L4 15a2 2 0 0 0 0 2.8l2.2 2.2A2 2 0 0 0 9 20l6.5-6.5Z" />
      <circle cx="19" cy="18" r="2" />
    </>
  ),
  pickleball: (
    <>
      <rect x="9" y="3" width="11" height="12" rx="4" transform="rotate(35 14.5 9)" />
      <path d="m8.5 15-4.5 5" />
      <circle cx="18" cy="19" r="1.8" />
    </>
  ),
  kabaddi: (
    <>
      <circle cx="9" cy="5" r="2" />
      <path d="m9 7-1 6 3 3v5" />
      <path d="m8 13-3 3-1 4" />
      <path d="m6 9 3-1 4 2 3-1" />
      <path d="M18 4v16" strokeDasharray="2 2" />
    </>
  ),
  chess: (
    <>
      <path d="M8 21h8M9 18h6l1 3H8l1-3Z" />
      <path d="M10 18c0-3-2-4-2-7h8c0 3-2 4-2 7" />
      <path d="M9 11V8l2 1 1-3 1 3 2-1v3" />
    </>
  ),
  other: (
    <>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4a3 3 0 0 0 3 3M17 6h3a3 3 0 0 1-3 3" />
    </>
  ),
};

export function SportIcon({ sport, className, strokeWidth = 1.75 }: { sport: string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={cn("size-5 shrink-0", className)} aria-hidden>
      {PATHS[sport] ?? PATHS.other}
    </svg>
  );
}
