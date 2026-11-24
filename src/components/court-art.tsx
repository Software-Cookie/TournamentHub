import { cn } from "@/lib/utils";

const PALETTES = [
  ["#030b25", "#2d5ab8", "#d9783f"],
  ["#030b25", "#3d6cc8", "#7aa2dc"],
  ["#020718", "#16264f", "#e49a68"],
  ["#030b25", "#234a99", "#d9783f"],
  ["#0a1636", "#2d5ab8", "#7aa2dc"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Generated badminton-court artwork used when a tournament has no banner image yet. */
export function CourtArt({ seed = "x", className }: { seed?: string; className?: string }) {
  const [bg, a, b] = PALETTES[hash(seed) % PALETTES.length]!;
  const id = `g${hash(seed) % 100000}`;
  return (
    <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className={cn("absolute inset-0 size-full", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg} />
          <stop offset="1" stopColor={a} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.8" cy="0.15" r="0.6">
          <stop offset="0" stopColor={b} stopOpacity="0.55" />
          <stop offset="1" stopColor={b} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="225" fill={`url(#${id}-bg)`} />
      <rect width="400" height="225" fill={`url(#${id}-glow)`} />
      {/* perspective court */}
      <g stroke="white" strokeOpacity="0.35" strokeWidth="1.5" fill="none">
        <path d="M60 225 L130 70 L270 70 L340 225 Z" />
        <path d="M80 225 L140 85 M320 225 L260 85" />
        <path d="M95 150 L305 150" />
        <path d="M117 110 L283 110" />
        <path d="M200 70 L200 225" />
        <path d="M70 200 L330 200" />
      </g>
      <path d="M100 135 L300 135" stroke="white" strokeOpacity="0.85" strokeWidth="2.5" />
      <path d="M100 135 L100 118 M300 135 L300 118 M100 118 L300 118" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" />
      {/* shuttle arc */}
      <path d="M40 190 Q 200 -20 345 60" stroke={b} strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" fill="none" opacity="0.9" />
      <g transform="translate(345 60) rotate(35)">
        <circle r="5" fill="white" />
        <path d="M-4 -3 L-16 -12 L-12 0 L-16 12 L-4 3 Z" fill="white" opacity="0.9" />
      </g>
    </svg>
  );
}
