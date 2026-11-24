import Link from "next/link";
import { CourtArt } from "@/components/court-art";

export default function NotFound() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-navy px-4 text-center text-white">
      <CourtArt seed="404" className="opacity-40" />
      <div className="relative">
        <p className="display text-[9rem] italic leading-none text-accent">404</p>
        <h1 className="display mt-2 text-4xl italic">Out of bounds</h1>
        <p className="mx-auto mt-3 max-w-sm text-white/70">That page landed outside the court. Let&apos;s get you back in play.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="rounded-xl bg-accent px-6 py-3 font-semibold hover:bg-accent-600">Home</Link>
          <Link href="/tournaments" className="rounded-xl border border-white/30 px-6 py-3 font-semibold hover:bg-white/10">Tournaments</Link>
        </div>
      </div>
    </div>
  );
}
