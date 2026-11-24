import Image from "next/image";
import Link from "next/link";
import { CourtArt } from "@/components/court-art";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="relative hidden overflow-hidden bg-navy lg:block">
        <CourtArt seed="auth-panel" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-navy/10" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/brand/logo-icon.png" alt="" width={44} height={44} className="rounded-lg" />
            <span className="display text-3xl italic">
              Tournament<span className="text-brand">Hub</span>
            </span>
          </Link>
          <div>
            <h2 className="display text-6xl italic leading-[0.9]">
              Play your game.
              <br />
              <span className="text-accent">Own your moment.</span>
            </h2>
            <p className="mt-4 max-w-md text-white/70">Your tickets, fixtures, results and receipts — in one place.</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col bg-canvas">
        <div className="flex items-center justify-between p-5 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/logo-icon.png" alt="" width={36} height={36} className="rounded-lg" />
            <span className="display text-2xl italic text-navy">
              Tournament<span className="text-brand">Hub</span>
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
