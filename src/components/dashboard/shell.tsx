"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Briefcase, Building2, CalendarRange, ClipboardList, CreditCard, LayoutDashboard, LogOut, MonitorPlay, ScanLine, ScrollText, Search, Settings, Swords, Tags, Ticket, Trophy, UserRound, Users, Wallet, type LucideIcon } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { cn, initials } from "@/lib/utils";
import { PremiumBadge } from "@/components/premium/premium-badge";

const Icons = { BarChart3, Bell, Briefcase, Building2, CalendarRange, ClipboardList, CreditCard, LayoutDashboard, MonitorPlay, ScanLine, ScrollText, Search, Settings, Swords, Tags, Ticket, Trophy, UserRound, Users, Wallet } satisfies Record<string, LucideIcon>;

export type NavItem = { href: string; label: string; icon: keyof typeof Icons; exact?: boolean };

export function DashboardShell({ nav, user, title, children, accent = "brand", footerLink }: { nav: NavItem[]; user: { name?: string | null; email?: string | null; isPremium?: boolean }; title: string; children: React.ReactNode; accent?: "brand" | "accent"; footerLink?: { href: string; label: string } }) {
  const pathname = usePathname();
  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`));
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-navy text-white lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
          <Image src="/brand/logo-icon.png" alt="" width={36} height={36} className="rounded-lg" />
          <span className="display text-2xl italic">
            Tournament<span className="text-brand-400">Hub</span>
          </span>
        </Link>
        <p className="eyebrow px-6 pb-2 pt-3 text-[0.65rem] text-white/40">{title}</p>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label={title}>
          {nav.map((n) => {
            const Icon = Icons[n.icon];
            const active = isActive(n);
            return (
              <Link key={n.href} href={n.href} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
                <Icon className={cn("size-[18px]", active && (accent === "accent" ? "text-accent" : "text-brand-400"))} />
                {n.label}
                {active && <span className={cn("ml-auto size-1.5 rounded-full", accent === "accent" ? "bg-accent" : "bg-brand")} />}
              </Link>
            );
          })}
        </nav>
        {footerLink && (
          <Link href={footerLink.href} className="mx-3 mb-2 rounded-xl border border-white/10 px-3 py-2.5 text-center text-xs font-semibold text-white/70 hover:bg-white/5 hover:text-white">
            {footerLink.label}
          </Link>
        )}
        <div className="flex items-center gap-3 border-t border-white/10 p-4">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand text-xs font-bold", user.isPremium && "ring-2 ring-premium")}>{initials(user.name ?? user.email)}</span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
              <span className="truncate">{user.name}</span>
              {user.isPremium && <PremiumBadge size="xs" label="Pro" />}
            </p>
            <p className="truncate text-xs text-white/50">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button className="grid size-9 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 pb-20 lg:pb-0">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 text-white lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/brand/logo-icon.png" alt="" width={30} height={30} className="rounded-md" />
            <span className="display text-xl italic">{title}</span>
          </Link>
          <form action={logoutAction}>
            <button className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-line bg-white shadow-[0_-8px_24px_-16px_rgb(7_18_46/0.4)] lg:hidden" aria-label="Mobile navigation">
        {nav.slice(0, 6).map((n) => {
          const Icon = Icons[n.icon];
          const active = isActive(n);
          return (
            <Link key={n.href} href={n.href} className={cn("flex min-w-16 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[0.65rem] font-semibold", active ? "text-brand-400" : "text-subtle")}>
              <Icon className="size-5" />
              <span className="truncate">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
