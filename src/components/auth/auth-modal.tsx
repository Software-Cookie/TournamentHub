"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { LoginForm, SignUpForm } from "@/components/auth/forms";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";
const PROMPTED_KEY = "th:auth-prompted";
const AUTO_DELAY_MS = 18_000;
const SCROLL_THRESHOLD = 0.55;
// Never interrupt these flows with the automatic prompt.
const QUIET_PATHS = [/^\/login/, /^\/register/, /^\/forgot-password/, /^\/reset-password/, /^\/verify/, /^\/dashboard/, /^\/admin/, /\/register$/, /\/checkout/];

export function openAuthModal(mode: Mode = "login") {
  window.dispatchEvent(new CustomEvent("th:open-auth", { detail: { mode } }));
}

export function AuthModal({ isAuthenticated, googleEnabled }: { isAuthenticated: boolean; googleEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signup");
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement>(null);

  const show = useCallback((m: Mode) => {
    setMode(m);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Closing counts as the prompt for this session, so it never pops up again on its own.
    try {
      sessionStorage.setItem(PROMPTED_KEY, "1");
    } catch {}
  }, []);

  // Manual trigger (Sign In / Register buttons)
  useEffect(() => {
    const handler = (e: Event) => show(((e as CustomEvent).detail?.mode as Mode) ?? "login");
    window.addEventListener("th:open-auth", handler);
    return () => window.removeEventListener("th:open-auth", handler);
  }, [show]);

  // Automatic, once-per-session prompt: after ~18s or ~55% scroll.
  useEffect(() => {
    if (isAuthenticated) return;
    if (QUIET_PATHS.some((r) => r.test(pathname))) return;
    if (sessionStorage.getItem(PROMPTED_KEY)) return;

    let fired = false;
    const trigger = () => {
      if (fired || sessionStorage.getItem(PROMPTED_KEY)) return;
      // Don't interrupt an active checkout or an open dialog.
      if (sessionStorage.getItem("th:checkout-active") || document.querySelector("[role=dialog][data-busy]")) return;
      fired = true;
      sessionStorage.setItem(PROMPTED_KEY, "1");
      show("signup");
      cleanup();
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= SCROLL_THRESHOLD) trigger();
    };
    const timer = window.setTimeout(trigger, AUTO_DELAY_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    }
    return cleanup;
  }, [isAuthenticated, pathname, show]);

  // Escape to close + basic focus management
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, close]);

  // Focus the first field when the dialog opens or the tab changes.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => dialogRef.current?.querySelector<HTMLInputElement>("input:not([type=hidden])")?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [open, mode]);

  if (isAuthenticated || !open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-navy/70 [animation:fade-in_.15s_ease-out]" onClick={close} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-lift [animation:menu-in_.18s_ease-out] sm:max-w-[440px] sm:rounded-3xl"
      >
        <div className="relative overflow-hidden bg-navy px-6 pb-6 pt-7 text-white">
          <div className="court-pattern pointer-events-none absolute inset-0 opacity-50" aria-hidden />
          <div className="relative flex items-center gap-3 pr-12">
            <Image src="/brand/logo-icon.png" alt="" width={44} height={44} className="rounded-xl" />
            <div>
              <h2 id="auth-title" className="display text-2xl italic">
                {mode === "login" ? "Welcome back" : "Join the game"}
              </h2>
              <p className="text-sm text-white/70">{mode === "login" ? "Sign in to manage your entries and tickets" : "Register for tournaments in minutes"}</p>
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-2 rounded-xl bg-white/10 p-1 text-sm font-semibold" role="tablist">
            {(["signup", "login"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded-lg py-2 transition-colors", mode === m ? "bg-white text-navy shadow" : "text-white/75 hover:text-white")}>
                {m === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        </div>
        {/* Rendered after the header so nothing can sit on top of it. */}
        <button type="button" onClick={close} className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25" aria-label="Close">
          <X className="size-5" />
        </button>
        <div className="p-6">
          {mode === "login" ? (
            <LoginForm googleEnabled={googleEnabled} callbackUrl={pathname} onSwitch={() => setMode("signup")} />
          ) : (
            <SignUpForm googleEnabled={googleEnabled} callbackUrl={pathname} onSwitch={() => setMode("login")} />
          )}
          <button type="button" onClick={close} className="mt-4 w-full rounded-lg py-2 text-center text-sm font-medium text-subtle transition-colors hover:text-ink">
            Cancel, keep browsing
          </button>
        </div>
      </div>
    </div>
  );
}
