"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, Shield, User, Users } from "lucide-react";
import { toast } from "sonner";
import { openPremiumModal } from "@/components/premium/premium-modal";
import { Badge, Button, Field } from "@/components/ui";
import { createRegistrationAction } from "@/server/actions/registration";
import { usePayment } from "@/components/payments/use-payment";
import { cn, formatMoney } from "@/lib/utils";
import type { CustomQuestion } from "@/lib/validation";

export type RegCategory = {
  id: string;
  name: string;
  teamSize: number;
  minTeamSize: number | null;
  participantType: "INDIVIDUAL" | "TEAM";
  genderRule: "OPEN" | "MALE" | "FEMALE" | "MIXED";
  fee: number;
  left: number | null;
  minAge: number | null;
  maxAge: number | null;
  existingRegistrationId: string | null;
  eligibility: string;
};

type Player = { fullName: string; email: string; phone: string; dateOfBirth: string; gender: string; city: string; emergencyContactName: string; emergencyContactPhone: string; skillLevel: string };
const emptyPlayer = (): Player => ({ fullName: "", email: "", phone: "", dateOfBirth: "", gender: "", city: "", emergencyContactName: "", emergencyContactPhone: "", skillLevel: "" });

const STEPS = ["Category", "Details", "Review & pay"];

export function RegistrationForm({
  tournament,
  categories,
  questions,
  prefill,
  paymentAvailable,
  requiresApproval,
}: {
  tournament: { id: string; name: string; slug: string; terms: string | null; refundPolicy: string | null };
  categories: RegCategory[];
  questions: CustomQuestion[];
  prefill: { name: string; email: string; phone: string; city: string };
  paymentAvailable: boolean;
  requiresApproval: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(categories.find((c) => !c.existingRegistrationId && c.left !== 0)?.id ?? null);
  const cat = categories.find((c) => c.id === categoryId) ?? null;
  const [players, setPlayers] = useState<Player[]>([{ ...emptyPlayer(), fullName: prefill.name, email: prefill.email, phone: prefill.phone, city: prefill.city }, emptyPlayer()]);
  const [team, setTeam] = useState({ name: "", captainName: prefill.name, captainEmail: prefill.email, captainPhone: prefill.phone });
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [createdId, setCreatedId] = useState<string | null>(null);

  const { pay, busy, overlay } = usePayment({
    onVerified: (id) => router.push(`/dashboard/registrations/${id}?paid=1`),
    onFailed: () => createdId && router.push(`/dashboard/registrations/${createdId}`),
  });

  const isSquad = (cat?.teamSize ?? 1) > 2;
  const minSquad = cat ? (isSquad ? (cat.minTeamSize ?? cat.teamSize) : cat.teamSize) : 1;
  const [squadSize, setSquadSize] = useState(0);
  const rosterSize = isSquad ? Math.min(cat!.teamSize, Math.max(minSquad, squadSize)) : (cat?.teamSize ?? 1);
  const activePlayers = useMemo(() => {
    const list = players.slice(0, rosterSize);
    while (list.length < rosterSize) list.push(emptyPlayer());
    return list;
  }, [players, rosterSize]);
  // Single-gender squads don't need a gender per player: the category implies it.
  const impliedGender = isSquad && (cat?.genderRule === "MALE" || cat?.genderRule === "FEMALE") ? cat.genderRule : null;
  const genderRequired = cat ? cat.genderRule !== "OPEN" && !impliedGender : false;
  const needsAge = !!cat && (cat.minAge != null || cat.maxAge != null);
  const full = (i: number) => !isSquad || i === 0;

  const updatePlayer = (i: number, patch: Partial<Player>) =>
    setPlayers((ps) => {
      const next = [...ps];
      while (next.length <= i) next.push(emptyPlayer());
      next[i] = { ...next[i]!, ...patch };
      return next;
    });
  const removePlayer = (i: number) => {
    setPlayers((ps) => ps.filter((_, idx) => idx !== i));
    setSquadSize(rosterSize - 1);
  };
  const err = (k: string) => errors[k];

  function validateDetails() {
    const e: Record<string, string> = {};
    if (!cat) return false;
    if (cat.participantType === "TEAM") {
      if (team.name.trim().length < 2) e["team.name"] = "Enter a team name";
      if (team.captainName.trim().length < 2) e["team.captainName"] = "Enter the captain's name";
      if (!/^\S+@\S+\.\S+$/.test(team.captainEmail)) e["team.captainEmail"] = "Enter a valid email";
      if (!/^\+?\d{10,14}$/.test(team.captainPhone.replace(/[\s()-]/g, ""))) e["team.captainPhone"] = "Enter a valid phone number";
    }
    const seen = new Set<string>();
    activePlayers.forEach((p, i) => {
      if (p.fullName.trim().length < 2) e[`players.${i}.fullName`] = "Enter a full name";
      const email = p.email.trim().toLowerCase();
      if (full(i) || email) {
        if (!/^\S+@\S+\.\S+$/.test(email)) e[`players.${i}.email`] = "Enter a valid email";
        else if (seen.has(email)) e[`players.${i}.email`] = "Each player needs a different email";
        seen.add(email);
      }
      if ((full(i) || p.phone.trim()) && !/^\+?\d{10,14}$/.test(p.phone.replace(/[\s()-]/g, ""))) e[`players.${i}.phone`] = "Enter a valid phone number";
      if ((full(i) || needsAge) && !p.dateOfBirth) e[`players.${i}.dateOfBirth`] = "Enter a date of birth";
      if (genderRequired && !p.gender) e[`players.${i}.gender`] = "Required for this category";
    });
    if (cat.genderRule === "MIXED" && activePlayers.every((p) => p.gender)) {
      const g = activePlayers.map((p) => p.gender);
      if (!(g.includes("MALE") && g.includes("FEMALE"))) e[`players.${activePlayers.length - 1}.gender`] = "A mixed entry needs at least one male and one female player";
    }
    for (const q of questions) if (q.required && (answers[q.id] === undefined || answers[q.id] === "" || answers[q.id] === false)) e[`answers.${q.id}`] = "Required";
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Please fix the highlighted fields.");
      setTimeout(() => document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return false;
    }
    setFormError(null);
    return true;
  }

  function submit() {
    if (!cat) return;
    if (!accept) {
      setFormError("Please accept the terms and conditions to continue.");
      return;
    }
    start(async () => {
      const payload = {
        tournamentId: tournament.id,
        categoryId: cat.id,
        team: cat.participantType === "TEAM" ? team : undefined,
        players: activePlayers.map((p) => ({
          fullName: p.fullName,
          email: p.email.trim() || undefined,
          phone: p.phone.trim() || undefined,
          dateOfBirth: p.dateOfBirth || undefined,
          gender: impliedGender ?? (p.gender || undefined),
          city: p.city || undefined,
          emergencyContactName: p.emergencyContactName || undefined,
          emergencyContactPhone: p.emergencyContactPhone || undefined,
          skillLevel: p.skillLevel || undefined,
        })),
        answers,
        acceptTerms: accept,
      };
      const res = await createRegistrationAction(payload);
      if (!res.ok) {
        if (res.fieldErrors?.premium) {
          openPremiumModal();
          return;
        }
        setFormError(res.error);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          if (Object.keys(res.fieldErrors).some((k) => k.startsWith("players") || k.startsWith("team") || k.startsWith("answers"))) setStep(1);
        }
        toast.error(res.error);
        return;
      }
      const { id, status } = res.data!;
      setCreatedId(id);
      if (status === "PENDING_PAYMENT") await pay(id);
      else router.push(`/dashboard/registrations/${id}?${status === "CONFIRMED" ? "paid=1" : "submitted=1"}`);
    });
  }

  return (
    <div className="card overflow-hidden">
      {overlay}
      {/* Stepper */}
      <ol className="grid grid-cols-3 border-b border-line bg-canvas/60 text-xs font-semibold sm:text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("flex items-center justify-center gap-2 px-2 py-3.5", i === step ? "text-ink" : "text-subtle")}>
            <span className={cn("grid size-6 place-items-center rounded-full text-[0.7rem] font-bold transition", i < step ? "bg-success text-white" : i === step ? "bg-brand text-white" : "bg-line text-muted")}>{i < step ? <Check className="size-3.5" /> : i + 1}</span>
            <span className="hidden sm:inline">{s}</span>
          </li>
        ))}
      </ol>
      <div className="h-1 bg-line">
        <motion.div className="h-full bg-gradient-to-r from-brand to-accent" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="p-5 sm:p-8">
        {formError && (
          <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {formError}
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            {step === 0 && (
              <div>
                <h2 className="text-xl font-extrabold">Choose your category</h2>
                <p className="mt-1 text-sm text-muted">The form adapts to singles or doubles automatically.</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {categories.map((c) => {
                    const disabled = c.left === 0 || !!c.existingRegistrationId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setCategoryId(c.id)}
                        className={cn(
                          "relative rounded-2xl border-2 p-4 text-left transition",
                          categoryId === c.id ? "border-brand bg-brand-50/60 shadow-sm" : "border-line bg-white hover:border-brand/40",
                          disabled && "cursor-not-allowed opacity-60 hover:border-line",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="grid size-10 place-items-center rounded-xl bg-navy text-white">{c.teamSize > 1 ? <Users className="size-5" /> : <User className="size-5" />}</div>
                            <div>
                              <p className="font-extrabold">{c.name}</p>
                              <p className="text-xs text-subtle">{c.eligibility}</p>
                            </div>
                          </div>
                          {categoryId === c.id && <CheckCircle2 className="size-5 text-brand" />}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-lg font-extrabold">{c.fee === 0 ? "Free" : formatMoney(c.fee)}</span>
                          {c.existingRegistrationId ? <Badge tone="green">Already registered</Badge> : c.left === 0 ? <Badge tone="red">Full</Badge> : c.left != null ? <Badge tone={c.left <= 5 ? "orange" : "gray"}>{c.left} slots left</Badge> : null}
                        </div>
                        {c.existingRegistrationId && (
                          <Link href={`/dashboard/registrations/${c.existingRegistrationId}`} className="mt-2 inline-block text-xs font-bold text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
                            View your entry →
                          </Link>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-8 flex justify-end">
                  <Button onClick={() => cat && setStep(1)} disabled={!cat} size="lg">
                    Continue <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 1 && cat && (
              <div className="space-y-8">
                {cat.participantType === "TEAM" && (
                  <fieldset>
                    <legend className="mb-4 text-lg font-extrabold">Team information</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Team name" required htmlFor="team-name" error={err("team.name")} className="sm:col-span-2">
                        <input id="team-name" className="input" value={team.name} onChange={(e) => setTeam({ ...team, name: e.target.value })} aria-invalid={!!err("team.name") || undefined} maxLength={50} placeholder="e.g. Smash Brothers" />
                      </Field>
                      <Field label="Captain name" required htmlFor="cap-name" error={err("team.captainName")}>
                        <input id="cap-name" className="input" value={team.captainName} onChange={(e) => setTeam({ ...team, captainName: e.target.value })} aria-invalid={!!err("team.captainName") || undefined} />
                      </Field>
                      <Field label="Captain email" required htmlFor="cap-email" error={err("team.captainEmail")}>
                        <input id="cap-email" type="email" className="input" value={team.captainEmail} onChange={(e) => setTeam({ ...team, captainEmail: e.target.value })} aria-invalid={!!err("team.captainEmail") || undefined} />
                      </Field>
                      <Field label="Captain phone" required htmlFor="cap-phone" error={err("team.captainPhone")}>
                        <input id="cap-phone" type="tel" inputMode="tel" className="input" value={team.captainPhone} onChange={(e) => setTeam({ ...team, captainPhone: e.target.value })} aria-invalid={!!err("team.captainPhone") || undefined} placeholder="+91 98765 43210" />
                      </Field>
                    </div>
                  </fieldset>
                )}

                {activePlayers.map((p, i) => !full(i) ? null : (
                  <fieldset key={i} className="rounded-2xl border border-line p-4 sm:p-5">
                    <legend className="px-2 text-lg font-extrabold">{isSquad ? "Captain (player 1)" : cat.teamSize > 1 ? `Player ${i + 1}` : "Player details"}</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Full name" required htmlFor={`p${i}-name`} error={err(`players.${i}.fullName`)}>
                        <input id={`p${i}-name`} className="input" autoComplete={i === 0 ? "name" : "off"} value={p.fullName} onChange={(e) => updatePlayer(i, { fullName: e.target.value })} aria-invalid={!!err(`players.${i}.fullName`) || undefined} />
                      </Field>
                      <Field label="Email" required htmlFor={`p${i}-email`} error={err(`players.${i}.email`)}>
                        <input id={`p${i}-email`} type="email" className="input" value={p.email} onChange={(e) => updatePlayer(i, { email: e.target.value })} aria-invalid={!!err(`players.${i}.email`) || undefined} />
                      </Field>
                      <Field label="Phone" required htmlFor={`p${i}-phone`} error={err(`players.${i}.phone`)}>
                        <input id={`p${i}-phone`} type="tel" inputMode="tel" className="input" value={p.phone} onChange={(e) => updatePlayer(i, { phone: e.target.value })} aria-invalid={!!err(`players.${i}.phone`) || undefined} />
                      </Field>
                      <Field label="Date of birth" required htmlFor={`p${i}-dob`} error={err(`players.${i}.dateOfBirth`)} hint={cat.minAge || cat.maxAge ? `Age ${cat.minAge ?? "any"}–${cat.maxAge ?? "any"} on tournament day` : undefined}>
                        <input id={`p${i}-dob`} type="date" className="input" value={p.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => updatePlayer(i, { dateOfBirth: e.target.value })} aria-invalid={!!err(`players.${i}.dateOfBirth`) || undefined} />
                      </Field>
                      {!impliedGender && <Field label="Gender" required={genderRequired} htmlFor={`p${i}-gender`} error={err(`players.${i}.gender`)}>
                        <select id={`p${i}-gender`} className="input" value={p.gender} onChange={(e) => updatePlayer(i, { gender: e.target.value })} aria-invalid={!!err(`players.${i}.gender`) || undefined}>
                          <option value="">{genderRequired ? "Select" : "Prefer not to say"}</option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </Field>}
                      {cat.teamSize === 1 && (
                        <>
                          <Field label="City" htmlFor={`p${i}-city`}>
                            <input id={`p${i}-city`} className="input" value={p.city} onChange={(e) => updatePlayer(i, { city: e.target.value })} />
                          </Field>
                          <Field label="Emergency contact name" htmlFor={`p${i}-ecn`}>
                            <input id={`p${i}-ecn`} className="input" value={p.emergencyContactName} onChange={(e) => updatePlayer(i, { emergencyContactName: e.target.value })} />
                          </Field>
                          <Field label="Emergency contact number" htmlFor={`p${i}-ecp`}>
                            <input id={`p${i}-ecp`} type="tel" className="input" value={p.emergencyContactPhone} onChange={(e) => updatePlayer(i, { emergencyContactPhone: e.target.value })} />
                          </Field>
                          <Field label="Skill level (optional)" htmlFor={`p${i}-skill`}>
                            <select id={`p${i}-skill`} className="input" value={p.skillLevel} onChange={(e) => updatePlayer(i, { skillLevel: e.target.value })}>
                              <option value="">—</option>
                              <option>Beginner</option>
                              <option>Intermediate</option>
                              <option>Advanced</option>
                              <option>Professional</option>
                            </select>
                          </Field>
                        </>
                      )}
                    </div>
                  </fieldset>
                ))}

                {isSquad && (
                  <fieldset className="rounded-2xl border border-line p-4 sm:p-5">
                    <legend className="px-2 text-lg font-extrabold">Squad ({rosterSize} of {cat.teamSize} players)</legend>
                    <p className="mb-3 text-sm text-muted">
                      Add {minSquad === cat.teamSize ? `all ${cat.teamSize}` : `${minSquad}–${cat.teamSize}`} players including the captain. Only names are required — phone and email help the organiser reach your players.
                    </p>
                    <div className="space-y-2">
                      {activePlayers.map((p, i) =>
                        i === 0 ? null : (
                          <div key={i} className="grid gap-2 rounded-xl bg-canvas p-2.5 sm:grid-cols-[2rem_1.4fr_1fr_1.2fr_auto] sm:items-start">
                            <span className="pt-2.5 text-center text-xs font-bold text-subtle">{i + 1}</span>
                            <div>
                              <input className="input" placeholder="Full name" value={p.fullName} onChange={(e) => updatePlayer(i, { fullName: e.target.value })} aria-label={`Player ${i + 1} name`} aria-invalid={!!err(`players.${i}.fullName`) || undefined} />
                              {err(`players.${i}.fullName`) && <p className="mt-1 text-xs font-medium text-danger">{err(`players.${i}.fullName`)}</p>}
                            </div>
                            <div>
                              <input className="input" type="tel" inputMode="tel" placeholder="Phone (optional)" value={p.phone} onChange={(e) => updatePlayer(i, { phone: e.target.value })} aria-label={`Player ${i + 1} phone`} aria-invalid={!!err(`players.${i}.phone`) || undefined} />
                              {err(`players.${i}.phone`) && <p className="mt-1 text-xs font-medium text-danger">{err(`players.${i}.phone`)}</p>}
                            </div>
                            <div className="grid gap-2">
                              <input className="input" type="email" placeholder="Email (optional)" value={p.email} onChange={(e) => updatePlayer(i, { email: e.target.value })} aria-label={`Player ${i + 1} email`} aria-invalid={!!err(`players.${i}.email`) || undefined} />
                              {err(`players.${i}.email`) && <p className="text-xs font-medium text-danger">{err(`players.${i}.email`)}</p>}
                              {needsAge && <input className="input" type="date" value={p.dateOfBirth} onChange={(e) => updatePlayer(i, { dateOfBirth: e.target.value })} aria-label={`Player ${i + 1} date of birth`} aria-invalid={!!err(`players.${i}.dateOfBirth`) || undefined} />}
                              {genderRequired && (
                                <select className="input" value={p.gender} onChange={(e) => updatePlayer(i, { gender: e.target.value })} aria-label={`Player ${i + 1} gender`} aria-invalid={!!err(`players.${i}.gender`) || undefined}>
                                  <option value="">Gender</option>
                                  <option value="MALE">Male</option>
                                  <option value="FEMALE">Female</option>
                                  <option value="OTHER">Other</option>
                                </select>
                              )}
                              {err(`players.${i}.gender`) && <p className="text-xs font-medium text-danger">{err(`players.${i}.gender`)}</p>}
                            </div>
                            <button type="button" onClick={() => removePlayer(i)} disabled={rosterSize <= minSquad} className="h-11 rounded-lg px-3 text-sm font-semibold text-subtle hover:bg-red-50 hover:text-danger disabled:invisible" aria-label={`Remove player ${i + 1}`}>
                              Remove
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                    {rosterSize < cat.teamSize && (
                      <Button variant="secondary" size="sm" className="mt-3" onClick={() => setSquadSize(rosterSize + 1)}>
                        Add player
                      </Button>
                    )}
                  </fieldset>
                )}

                {questions.length > 0 && (
                  <fieldset>
                    <legend className="mb-4 text-lg font-extrabold">A few more questions from the organiser</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {questions.map((q) => (
                        <Field key={q.id} label={q.label} required={q.required} htmlFor={`q-${q.id}`} error={err(`answers.${q.id}`)} className={q.type === "checkbox" ? "sm:col-span-2" : ""}>
                          {q.type === "select" ? (
                            <select id={`q-${q.id}`} className="input" value={String(answers[q.id] ?? "")} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} aria-invalid={!!err(`answers.${q.id}`) || undefined}>
                              <option value="">Select</option>
                              {q.options?.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          ) : q.type === "checkbox" ? (
                            <label className="flex items-center gap-2 text-sm">
                              <input id={`q-${q.id}`} type="checkbox" className="size-4 accent-brand" checked={answers[q.id] === true} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.checked })} /> Yes
                            </label>
                          ) : (
                            <input id={`q-${q.id}`} className="input" value={String(answers[q.id] ?? "")} maxLength={500} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} aria-invalid={!!err(`answers.${q.id}`) || undefined} />
                          )}
                        </Field>
                      ))}
                    </div>
                  </fieldset>
                )}

                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    <ArrowLeft className="size-4" /> Back
                  </Button>
                  <Button size="lg" onClick={() => validateDetails() && setStep(2)}>
                    Review <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && cat && (
              <div>
                <h2 className="text-xl font-extrabold">Review your entry</h2>
                <div className="mt-4 divide-y divide-line rounded-2xl border border-line">
                  <ReviewRow label="Tournament" value={tournament.name} />
                  <ReviewRow label="Category" value={cat.name} />
                  {cat.participantType === "TEAM" && <ReviewRow label="Team" value={`${team.name} (captain: ${team.captainName})`} />}
                  {activePlayers.map((p, i) => (
                    <ReviewRow key={i} label={cat.teamSize > 1 ? `Player ${i + 1}` : "Player"} value={`${p.fullName} · ${p.email} · ${p.phone}`} />
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between rounded-2xl bg-navy p-5 text-white">
                  <div>
                    <p className="text-sm text-white/70">Total payable</p>
                    <p className="text-xs text-white/50">Inclusive of all charges</p>
                  </div>
                  <p className="display text-4xl">{cat.fee === 0 ? "Free" : formatMoney(cat.fee)}</p>
                </div>

                {(tournament.terms || tournament.refundPolicy) && (
                  <details className="mt-5 rounded-xl border border-line p-4 text-sm">
                    <summary className="cursor-pointer font-semibold">Read the terms & refund policy</summary>
                    <div className="mt-3 max-h-48 space-y-3 overflow-y-auto whitespace-pre-line text-muted">
                      {tournament.terms && <p>{tournament.terms}</p>}
                      {tournament.refundPolicy && <p>{tournament.refundPolicy}</p>}
                    </div>
                  </details>
                )}
                <label className="mt-4 flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                  <span>
                    I confirm the details are correct and accept the tournament{" "}
                    <Link href={`/tournaments/${tournament.slug}#terms`} target="_blank" className="font-semibold text-brand underline">
                      terms & conditions
                    </Link>{" "}
                    and{" "}
                    <Link href="/refund-policy" target="_blank" className="font-semibold text-brand underline">
                      refund policy
                    </Link>
                    .
                  </span>
                </label>
                {requiresApproval && <p className="mt-3 rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800">Entries for this tournament are reviewed by the organiser. Your ticket is issued once approved; if declined you&apos;ll be refunded in full.</p>}
                {cat.fee > 0 && !paymentAvailable && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Online payment isn&apos;t configured yet. Please contact the organiser.</p>}

                <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
                  <Button variant="ghost" onClick={() => setStep(1)} disabled={pending || busy}>
                    <ArrowLeft className="size-4" /> Back
                  </Button>
                  <Button size="lg" variant="accent" onClick={submit} loading={pending || busy} disabled={cat.fee > 0 && !paymentAvailable}>
                    {cat.fee === 0 ? (
                      <>Confirm registration</>
                    ) : (
                      <>
                        <CreditCard className="size-4" /> Pay {formatMoney(cat.fee)} securely
                      </>
                    )}
                  </Button>
                </div>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-subtle">
                  <Shield className="size-3.5" /> Secured by Razorpay · UPI, cards, netbanking & wallets
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-muted">{label}</span>
      <span className="font-semibold sm:text-right">{value}</span>
    </div>
  );
}
