"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Download, Ticket, X } from "lucide-react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui";

/** Shown only after the backend has verified the payment (status === CONFIRMED). */
export function PaymentSuccess({ registrationId, tournamentName, categoryName, code, awaitingApproval }: { registrationId: string; tournamentName: string; categoryName: string; code: string; awaitingApproval?: boolean }) {
  const [open, setOpen] = useState(true);
  const reduce = useReducedMotion();

  useEffect(() => {
    // Clean the URL so a refresh doesn't replay the celebration.
    const url = new URL(window.location.href);
    url.searchParams.delete("paid");
    url.searchParams.delete("submitted");
    window.history.replaceState(null, "", url.toString());
    if (reduce || awaitingApproval) return;
    const colors = ["#2D5AB8", "#7AA2DC", "#D9783F", "#D8B466"];
    const t = setTimeout(() => {
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.55 }, colors, disableForReducedMotion: true });
      setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }), 250);
      setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }), 400);
    }, 550);
    return () => clearTimeout(t);
  }, [reduce, awaitingApproval]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-navy/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="success-title">
          <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ type: "spring", damping: 22, stiffness: 260 }} className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white text-center shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full text-subtle hover:bg-canvas" aria-label="Close">
              <X className="size-4" />
            </button>
            <div className={`relative px-6 pb-6 pt-10 ${awaitingApproval ? "bg-gradient-to-b from-violet-50" : "bg-gradient-to-b from-green-50"} to-white`}>
              <svg viewBox="0 0 100 100" className="mx-auto size-24" aria-hidden>
                <motion.circle cx="50" cy="50" r="44" fill="none" stroke={awaitingApproval ? "#7c3aed" : "#16A34A"} strokeWidth="6" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: "easeOut" }} style={{ rotate: -90, transformOrigin: "50% 50%" }} />
                <motion.path d="M30 52 L44 66 L71 37" fill="none" stroke={awaitingApproval ? "#7c3aed" : "#16A34A"} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }} />
              </svg>
              <motion.h2 id="success-title" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="display mt-4 text-4xl italic text-navy">
                {awaitingApproval ? "Entry submitted!" : "You're in!"}
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }} className="mt-2 text-muted">
                {awaitingApproval ? (
                  <>Your entry for <strong>{categoryName}</strong> at <strong>{tournamentName}</strong> is awaiting organiser approval. We&apos;ll email your ticket once approved.</>
                ) : (
                  <>Payment verified. Your <strong>{categoryName}</strong> entry at <strong>{tournamentName}</strong> is confirmed — your ticket is on its way to your inbox.</>
                )}
              </motion.p>
              <p className="mt-3 font-mono text-sm font-bold text-navy">{code}</p>
            </div>
            {!awaitingApproval && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="grid gap-2 p-6 pt-0 sm:grid-cols-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setOpen(false);
                    setTimeout(() => document.getElementById("ticket")?.scrollIntoView({ behavior: "smooth" }), 200);
                  }}
                >
                  <Ticket className="size-4" /> View ticket
                </Button>
                <a href={`/api/tickets/${registrationId}/pdf`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-white hover:bg-accent-600">
                  <Download className="size-4" /> Download ticket
                </a>
              </motion.div>
            )}
            {awaitingApproval && (
              <div className="p-6 pt-0">
                <Button className="w-full" onClick={() => setOpen(false)}>Got it</Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
