"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Briefcase, Crown, LayoutDashboard, LogOut, Menu, Shield, Ticket, X } from "lucide-react";
import { openPremiumModal } from "@/components/premium/premium-modal";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { openAuthModal } from "@/components/auth/auth-modal";
import { buttonClass } from "@/components/ui";
import { logoutAction } from "@/server/actions/auth";
import { cn, initials } from "@/lib/utils";

type HeaderUser = { name?: string | null; email?: string | null; isAdmin: boolean; isOrganiser: boolean; isPremium: boolean } | null;

const NAV = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/#sports", label: "Sports" },
  { href: "/host", label: "Host a tournament" },
  { href: "/#how-it-works", label: "How it works" },
];

export function SiteHeader({ user }: { user: HeaderUser }) {
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 24));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
    setAccount(false);
  }, [pathname]);
  useEffect(() => {
    if (!account) return;
    const close = (e: MouseEvent) => !(e.target as HTMLElement).closest("[data-account-menu]") && setAccount(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAccount(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, [account]);

  const solid = scrolled || menu;

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-300", solid ? "bg-navy shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)]" : "bg-gradient-to-b from-navy/80 to-transparent")}>
      <div className="flex h-16 w-full items-center justify-between gap-4 px-5 sm:px-8 lg:px-14 xl:px-20">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TournamentHub home">
          <Image src="/brand/logo-icon.png" alt="" width={38} height={38} className="rounded-lg" priority />
          <span className="display text-[1.55rem] italic text-white">
            Tournament<span className="text-brand-400">Hub</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cn("rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors", pathname === n.href ? "text-white" : "text-white/75 hover:text-white")}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative" data-account-menu>
              <button onClick={() => setAccount((a) => !a)} className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm font-semibold text-white transition-colors hover:bg-white/20" aria-expanded={account} aria-haspopup="menu">
                <span className={cn("grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand text-xs font-bold", user.isPremium && "ring-2 ring-premium")}>{initials(user.name ?? user.email)}</span>
                <span className="hidden max-w-[120px] truncate sm:inline">{user.name?.split(" ")[0] ?? "Account"}</span>
              </button>
              {account && (
                <div role="menu" className="absolute right-0 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-lift [animation:menu-in_.14s_ease-out]">
                  <div className="border-b border-line px-3 py-2.5">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <span className="truncate">{user.name}</span>
                      {user.isPremium && <PremiumBadge size="xs" />}
                    </p>
                    <p className="truncate text-xs text-subtle">{user.email}</p>
                  </div>
                  <MenuLink href="/dashboard" icon={<LayoutDashboard className="size-4" />}>My dashboard</MenuLink>
                  <MenuLink href="/dashboard/tickets" icon={<Ticket className="size-4" />}>My tickets</MenuLink>
                  <MenuLink href={user.isOrganiser || user.isAdmin ? "/manage" : "/host"} icon={<Briefcase className="size-4" />}>{user.isOrganiser || user.isAdmin ? "Organiser console" : "Host a tournament"}</MenuLink>
                  {!user.isPremium && (
                    <button type="button" role="menuitem" onClick={() => { setAccount(false); openPremiumModal(); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas">
                      <Crown className="size-4 text-premium-600" /> Get Premium
                    </button>
                  )}
                  {user.isAdmin && <MenuLink href="/admin" icon={<Shield className="size-4" />}>Platform admin</MenuLink>}
                  <form action={logoutAction}>
                    <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-danger hover:bg-red-50">
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <>
              <button onClick={() => openAuthModal("login")} className="hidden rounded-lg px-3.5 py-2 text-sm font-semibold text-white/85 transition-colors hover:text-white sm:block">
                Sign in
              </button>
              <button onClick={() => openAuthModal("signup")} className={buttonClass("accent", "sm", "hidden sm:inline-flex", true)}>
                <span>Join free</span>
              </button>
            </>
          )}
          <button onClick={() => setMenu((m) => !m)} className="grid size-10 place-items-center rounded-lg text-white transition-colors hover:bg-white/10 lg:hidden" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu}>
            {menu ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {menu && (
        <nav className="border-t border-white/10 bg-navy lg:hidden" aria-label="Mobile">
          <div className="space-y-1 px-4 py-4">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="block rounded-xl px-3 py-3 text-base font-semibold text-white/90 hover:bg-white/10">
                {n.label}
              </Link>
            ))}
            {!user && (
              <div className="grid grid-cols-2 gap-2 pt-3">
                <button onClick={() => openAuthModal("login")} className={buttonClass("outline-light", "md")}>
                  Sign in
                </button>
                <button onClick={() => openAuthModal("signup")} className={buttonClass("accent", "md")}>
                  Join free
                </button>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} role="menuitem" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-canvas">
      {icon}
      {children}
    </Link>
  );
}
