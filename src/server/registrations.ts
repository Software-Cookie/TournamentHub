import "server-only";
import { after } from "next/server";
import { Prisma, type RegistrationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { humanCode } from "@/lib/tokens";
import { formatDate, formatMoney, mapsLink } from "@/lib/utils";
import { issueTicket, renderTicketPdf, ticketInclude, DEFAULT_INSTRUCTIONS } from "@/lib/tickets";
import { createOrder, createRefund, fetchAndCapturePayment, paymentMode, publicKeyId, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { sendEmail } from "@/lib/email/send";
import * as T from "@/lib/email/templates";
import { parseCustomQuestions, type RegistrationInput } from "@/lib/validation";
import { requiresFullDetails } from "@/lib/sports";
import { isPremiumActive, isPremiumEvent } from "@/lib/pricing";
import type { SessionUser } from "@/lib/authz";

export const HOLD_MINUTES = 20;

export class RegistrationError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

/** Statuses that occupy a slot. PENDING_PAYMENT only counts while its hold is valid. */
export function activeEntryWhere(now = new Date()): Prisma.RegistrationWhereInput {
  return {
    OR: [
      { status: { in: ["CONFIRMED", "PENDING_APPROVAL"] } },
      { status: "PENDING_PAYMENT", expiresAt: { gt: now } },
    ],
  };
}

export function categoryFee(t: { entryFee: number }, c: { entryFee: number | null }) {
  return c.entryFee ?? t.entryFee;
}

export function registrationWindow(t: { status: string; registrationOpensAt: Date; registrationClosesAt: Date }, now = new Date()) {
  if (t.status !== "PUBLISHED") return { open: false, reason: t.status === "DRAFT" ? "Not yet published" : "Registration closed" } as const;
  if (now < t.registrationOpensAt) return { open: false, reason: `Opens ${formatDate(t.registrationOpensAt)}` } as const;
  if (now > t.registrationClosesAt) return { open: false, reason: "Registration closed" } as const;
  return { open: true, reason: null } as const;
}

/** Release slots held by unpaid registrations whose hold expired. */
export async function expireStaleHolds(tx: Prisma.TransactionClient = db, tournamentId?: string) {
  const stale = await tx.registration.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lte: new Date() }, ...(tournamentId ? { tournamentId } : {}) },
    select: { id: true, teamId: true },
  });
  if (!stale.length) return 0;
  const ids = stale.map((s) => s.id);
  await tx.registration.updateMany({ where: { id: { in: ids }, status: "PENDING_PAYMENT" }, data: { status: "EXPIRED", activeKey: null } });
  await tx.participant.updateMany({ where: { registrationId: { in: ids } }, data: { activeKey: null } });
  const teamIds = stale.map((s) => s.teamId).filter(Boolean) as string[];
  if (teamIds.length) await tx.team.updateMany({ where: { id: { in: teamIds } }, data: { activeKey: null } });
  await tx.payment.updateMany({ where: { registrationId: { in: ids }, status: { in: ["CREATED", "PENDING"] } }, data: { status: "FAILED", failureReason: "Payment window expired" } });
  return ids.length;
}

function ageOn(dob: Date, on: Date) {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

function uniqueViolationTarget(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const target = (e.meta?.target as string[] | string | undefined) ?? "";
    return Array.isArray(target) ? target.join(",") : target;
  }
  return null;
}

/**
 * Create a registration. Everything that matters (fee, capacity, eligibility, window) is
 * derived from the database — nothing from the client is trusted beyond the form data.
 */
export async function createRegistration(user: SessionUser, input: RegistrationInput) {
  const now = new Date();
  const tournament = await db.tournament.findUnique({
    where: { id: input.tournamentId },
    include: { categories: true },
  });
  if (!tournament) throw new RegistrationError("Tournament not found.");
  const category = tournament.categories.find((c) => c.id === input.categoryId);
  if (!category) throw new RegistrationError("Category not found.");

  const window = registrationWindow(tournament, now);
  if (!window.open) throw new RegistrationError(`Registration is not open: ${window.reason}.`);
  if (category.status !== "OPEN") throw new RegistrationError("This category is no longer accepting entries.");
  // Premium events (prize pool above ₹30,000) are open to Premium members only. Checked against the database, never the client.
  if (isPremiumEvent(tournament.prizePoolValue)) {
    const member = await db.user.findUnique({ where: { id: user.id }, select: { premiumUntil: true } });
    if (!isPremiumActive(member?.premiumUntil)) throw new RegistrationError("This is a premium event. Get Premium to register.", { premium: "required" });
  }

  // ── Shape validation per category
  const fieldErrors: Record<string, string> = {};
  const minPlayers = category.teamSize > 2 ? (category.minTeamSize ?? category.teamSize) : category.teamSize;
  if (input.players.length < minPlayers || input.players.length > category.teamSize) {
    throw new RegistrationError(minPlayers === category.teamSize ? `This category needs exactly ${category.teamSize} player(s).` : `Add between ${minPlayers} and ${category.teamSize} players to your squad.`);
  }
  if (category.participantType === "TEAM" && !input.team) fieldErrors["team.name"] = "Team details are required";
  // Full contact details: every player in singles/doubles, the captain (player 1) in larger squads.
  const needsAge = category.minAge != null || category.maxAge != null;
  input.players.forEach((p, i) => {
    if (requiresFullDetails(category.teamSize, i)) {
      if (!p.email) fieldErrors[`players.${i}.email`] = "Email is required";
      if (!p.phone) fieldErrors[`players.${i}.phone`] = "Phone is required";
      if (!p.dateOfBirth) fieldErrors[`players.${i}.dateOfBirth`] = "Date of birth is required";
    } else if (needsAge && !p.dateOfBirth) fieldErrors[`players.${i}.dateOfBirth`] = "Date of birth is required for this category";
  });
  const emails = input.players.map((p) => p.email).filter((e): e is string => !!e);
  const seen = new Set<string>();
  input.players.forEach((p, i) => {
    if (!p.email) return;
    if (seen.has(p.email)) fieldErrors[`players.${i}.email`] = "Each player needs a different email";
    seen.add(p.email);
  });
  // Gender rules
  if (category.genderRule !== "OPEN") {
    input.players.forEach((p, i) => {
      if (!p.gender) fieldErrors[`players.${i}.gender`] = "Gender is required for this category";
    });
    if (category.genderRule === "MALE") input.players.forEach((p, i) => p.gender && p.gender !== "MALE" && (fieldErrors[`players.${i}.gender`] = "This category is for men only"));
    if (category.genderRule === "FEMALE") input.players.forEach((p, i) => p.gender && p.gender !== "FEMALE" && (fieldErrors[`players.${i}.gender`] = "This category is for women only"));
    if (category.genderRule === "MIXED") {
      const g = input.players.map((p) => p.gender);
      if (!(g.includes("MALE") && g.includes("FEMALE"))) fieldErrors[`players.${input.players.length - 1}.gender`] = "A mixed entry needs at least one male and one female player";
    }
  }
  // Age rules (as of the tournament start date)
  if (needsAge) {
    input.players.forEach((p, i) => {
      if (!p.dateOfBirth) return;
      const age = ageOn(new Date(`${p.dateOfBirth}T00:00:00Z`), tournament.startDate);
      if (category.minAge != null && age < category.minAge) fieldErrors[`players.${i}.dateOfBirth`] = `Minimum age is ${category.minAge}`;
      if (category.maxAge != null && age > category.maxAge) fieldErrors[`players.${i}.dateOfBirth`] = `Maximum age is ${category.maxAge}`;
    });
  }
  // Organiser's custom questions
  const questions = parseCustomQuestions(tournament.customQuestions);
  const answers: Record<string, string | boolean> = {};
  for (const q of questions) {
    const a = input.answers[q.id];
    if (q.required && (a === undefined || a === "" || a === false)) fieldErrors[`answers.${q.id}`] = "This question is required";
    if (q.type === "select" && typeof a === "string" && a && q.options && !q.options.includes(a)) fieldErrors[`answers.${q.id}`] = "Pick one of the options";
    if (a !== undefined) answers[q.id] = a;
  }
  if (Object.keys(fieldErrors).length) throw new RegistrationError("Please fix the highlighted fields.", fieldErrors);

  const amount = categoryFee(tournament, category);
  const isFree = amount === 0;

  try {
    const registration = await db.$transaction(
      async (tx) => {
        // Serialise registrations per tournament so capacity checks can't race.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tournament.id}))`;
        await expireStaleHolds(tx, tournament.id);

        const activeWhere = activeEntryWhere(now);
        if (category.maxEntries != null) {
          const used = await tx.registration.count({ where: { categoryId: category.id, ...activeWhere } });
          if (used >= category.maxEntries) throw new RegistrationError("Sorry — this category is full.");
        }
        if (tournament.maxParticipants != null) {
          const used = await tx.registration.count({ where: { tournamentId: tournament.id, ...activeWhere } });
          if (used >= tournament.maxParticipants) throw new RegistrationError("Sorry — this tournament is full.");
        }
        if (!tournament.allowMultipleCategories) {
          const other = await tx.participant.findFirst({
            where: { tournamentId: tournament.id, email: { in: emails }, activeKey: { not: null } },
            select: { email: true },
          });
          if (other) throw new RegistrationError(`${other.email} is already registered in another category of this tournament (only one category is allowed).`);
        }

        const code = `${category.code}-${humanCode(6)}`;
        let teamId: string | undefined;
        if (category.participantType === "TEAM" && input.team) {
          const team = await tx.team.create({
            data: {
              tournamentId: tournament.id,
              categoryId: category.id,
              name: input.team.name,
              captainName: input.team.captainName,
              captainEmail: input.team.captainEmail,
              captainPhone: input.team.captainPhone,
              activeKey: `${category.id}:${input.team.name.toLowerCase().replace(/\s+/g, " ").trim()}`,
            },
          });
          teamId = team.id;
        }

        const status: RegistrationStatus = isFree ? (tournament.requiresApproval ? "PENDING_APPROVAL" : "CONFIRMED") : "PENDING_PAYMENT";
        const reg = await tx.registration.create({
          data: {
            code,
            tournamentId: tournament.id,
            categoryId: category.id,
            userId: user.id,
            teamId,
            status,
            amount,
            currency: tournament.currency,
            answers,
            termsAcceptedAt: now,
            activeKey: `${category.id}:${user.id}`,
            expiresAt: isFree ? null : new Date(now.getTime() + HOLD_MINUTES * 60_000),
            confirmedAt: status === "CONFIRMED" ? now : null,
          },
        });

        for (const [i, p] of input.players.entries()) {
          const participant = await tx.participant.create({
            data: {
              registrationId: reg.id,
              tournamentId: tournament.id,
              categoryId: category.id,
              fullName: p.fullName,
              email: p.email ?? null,
              phone: p.phone ?? null,
              dateOfBirth: p.dateOfBirth ? new Date(`${p.dateOfBirth}T00:00:00Z`) : null,
              gender: p.gender,
              city: p.city || null,
              emergencyContactName: p.emergencyContactName || null,
              emergencyContactPhone: p.emergencyContactPhone || null,
              skillLevel: p.skillLevel || null,
              // Duplicate-entry protection applies to every player whose email we know.
              activeKey: p.email ? `${category.id}:${p.email}` : null,
            },
          });
          if (teamId) {
            await tx.teamMember.create({
              data: { teamId, participantId: participant.id, slot: i + 1, role: i === 0 || (input.team && p.email === input.team.captainEmail) ? "CAPTAIN" : "PLAYER" },
            });
          }
        }
        if (status === "CONFIRMED") await issueTicket(tx, reg.id);
        await audit({ actorId: user.id, action: "registration.created", entityType: "Registration", entityId: reg.id, metadata: { code, amount, status } }, tx);
        return reg;
      },
      { timeout: 15_000 },
    );

    if (registration.status === "CONFIRMED") after(() => sendConfirmationEmails(registration.id));
    if (registration.status === "PENDING_APPROVAL") after(() => sendRegistrationReceived(registration.id, true));
    return registration;
  } catch (e) {
    const target = uniqueViolationTarget(e);
    if (target?.includes("activeKey")) {
      if (target.includes("Team") || (e as Prisma.PrismaClientKnownRequestError).message.includes("Team"))
        throw new RegistrationError("A team with this name is already registered in this category.", { "team.name": "Team name already taken in this category" });
      throw new RegistrationError(
        "Looks like you (or one of these players) already has an active entry in this category. Check My Tournaments — you can resume a pending payment there.",
      );
    }
    if (target?.includes("code")) throw new RegistrationError("Please try again.");
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────

/** Create (or reuse) a gateway order for a pending registration. Amount comes from the DB. */
export async function startPayment(user: SessionUser, registrationId: string) {
  const mode = paymentMode();
  if (mode === "unavailable") throw new RegistrationError("Online payments are not configured yet. Please contact the organiser.");

  const now = new Date();
  const reg = await db.registration.findUnique({
    where: { id: registrationId },
    include: { tournament: true, category: true, participants: { take: 1 }, payments: { where: { status: "CREATED" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!reg || reg.userId !== user.id) throw new RegistrationError("Registration not found.");
  if (reg.status === "CONFIRMED" || reg.status === "PENDING_APPROVAL") throw new RegistrationError("This registration is already paid.");
  if (reg.status !== "PENDING_PAYMENT" && reg.status !== "EXPIRED") throw new RegistrationError("This registration can no longer be paid.");
  const window = registrationWindow(reg.tournament, now);
  if (!window.open) throw new RegistrationError("Registration has closed for this tournament.");

  // Re-acquire / extend the slot hold under the tournament lock.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reg.tournamentId}))`;
    await expireStaleHolds(tx, reg.tournamentId);
    const fresh = await tx.registration.findUniqueOrThrow({ where: { id: reg.id }, include: { participants: true, team: true } });
    if (fresh.status === "EXPIRED") {
      const activeWhere = activeEntryWhere(now);
      if (reg.category.maxEntries != null) {
        const used = await tx.registration.count({ where: { categoryId: reg.categoryId, ...activeWhere } });
        if (used >= reg.category.maxEntries) throw new RegistrationError("Sorry — this category filled up while your payment was pending.");
      }
      if (reg.tournament.maxParticipants != null) {
        const used = await tx.registration.count({ where: { tournamentId: reg.tournamentId, ...activeWhere } });
        if (used >= reg.tournament.maxParticipants) throw new RegistrationError("Sorry — this tournament filled up while your payment was pending.");
      }
      try {
        await tx.registration.update({ where: { id: reg.id }, data: { status: "PENDING_PAYMENT", activeKey: `${reg.categoryId}:${reg.userId}` } });
        for (const p of fresh.participants) await tx.participant.update({ where: { id: p.id }, data: { activeKey: p.email ? `${reg.categoryId}:${p.email}` : null } });
        if (fresh.team) await tx.team.update({ where: { id: fresh.team.id }, data: { activeKey: `${reg.categoryId}:${fresh.team.name.toLowerCase().replace(/\s+/g, " ").trim()}` } });
      } catch (e) {
        if (uniqueViolationTarget(e)) throw new RegistrationError("Another active entry now uses this team name or one of these players. Please register again.");
        throw e;
      }
    }
    await tx.registration.update({ where: { id: reg.id }, data: { expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000) } });
  });

  let payment = reg.payments[0];
  if (!payment || payment.amount !== reg.amount) {
    const order = await createOrder(reg.amount, reg.currency, reg.code, { registrationId: reg.id, tournamentId: reg.tournamentId, code: reg.code });
    payment = await db.payment.create({
      data: { registrationId: reg.id, tournamentId: reg.tournamentId, userId: user.id, providerOrderId: order.id, amount: reg.amount, currency: reg.currency, status: "CREATED" },
    });
  }
  return {
    mode,
    keyId: publicKeyId(),
    orderId: payment.providerOrderId,
    amount: payment.amount,
    currency: payment.currency,
    registrationCode: reg.code,
    tournamentName: reg.tournament.name,
    categoryName: reg.category.name,
    prefill: { name: reg.participants[0]?.fullName ?? user.name ?? "", email: user.email ?? "", contact: reg.participants[0]?.phone ?? "" },
  };
}

type ConfirmInput = { orderId: string; paymentId: string; via: "checkout" | "webhook" | "reconcile"; signature?: string };

/**
 * Idempotently confirm a payment. Safe to call from both the checkout callback and the webhook,
 * any number of times, concurrently.
 */
export async function confirmPayment(input: ConfirmInput) {
  if (input.via === "checkout") {
    if (!input.signature || !verifyCheckoutSignature(input.orderId, input.paymentId, input.signature)) {
      throw new RegistrationError("Payment signature verification failed.");
    }
  }
  const payment = await db.payment.findUnique({ where: { providerOrderId: input.orderId } });
  if (!payment) throw new RegistrationError("Unknown order.");
  if (payment.status === "PAID" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED" || payment.status === "REFUND_PENDING") {
    return { registrationId: payment.registrationId, alreadyProcessed: true };
  }

  // Never trust the client: ask the gateway for the authoritative payment state.
  const gw = await fetchAndCapturePayment(input.paymentId, payment.amount, payment.currency);
  if (gw.orderId && gw.orderId !== input.orderId) throw new RegistrationError("Payment does not belong to this order.");
  if (gw.status !== "captured") {
    if (gw.status === "failed") await markPaymentFailed(input.orderId, gw.errorDescription ?? "Payment failed", input.paymentId);
    throw new RegistrationError(gw.status === "failed" ? "Payment failed." : "Payment is not yet captured. We'll confirm it automatically once the bank does.");
  }
  if (gw.amount !== payment.amount || gw.currency !== payment.currency) {
    await audit({ action: "payment.amount_mismatch", entityType: "Payment", entityId: payment.id, metadata: { expected: payment.amount, got: gw.amount } });
    throw new RegistrationError("Payment amount mismatch. Our team has been notified.");
  }

  const outcome = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.tournamentId}))`;
      // Conditional update = idempotency guard: only the first caller flips the status.
      const flipped = await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ["CREATED", "PENDING", "FAILED"] } },
        data: {
          status: "PAID",
          providerPaymentId: gw.id,
          providerSignature: input.signature ?? null,
          method: gw.method ?? null,
          fee: gw.fee ?? null,
          tax: gw.tax ?? null,
          paidAt: new Date(),
          verifiedVia: input.via,
          failureReason: null,
        },
      });
      if (flipped.count === 0) return { registrationId: payment.registrationId, alreadyProcessed: true, newStatus: null, needsRefund: false };

      const reg = await tx.registration.findUniqueOrThrow({ where: { id: payment.registrationId }, include: { tournament: true, category: true, participants: true, team: true } });
      // A second successful payment for an already-paid registration → refund the duplicate.
      const otherPaid = await tx.payment.count({ where: { registrationId: reg.id, status: "PAID", id: { not: payment.id } } });
      if (otherPaid > 0 || reg.status === "CONFIRMED" || reg.status === "PENDING_APPROVAL") {
        return { registrationId: reg.id, alreadyProcessed: false, newStatus: reg.status, needsRefund: true, refundReason: "Duplicate payment" };
      }

      if (reg.status === "EXPIRED" || reg.status === "CANCELLED") {
        // Paid after the hold lapsed — reinstate if a slot is still free, otherwise refund.
        const activeWhere = activeEntryWhere();
        const catFull = reg.category.maxEntries != null && (await tx.registration.count({ where: { categoryId: reg.categoryId, ...activeWhere } })) >= reg.category.maxEntries;
        const tFull = reg.tournament.maxParticipants != null && (await tx.registration.count({ where: { tournamentId: reg.tournamentId, ...activeWhere } })) >= reg.tournament.maxParticipants;
        if (reg.status === "CANCELLED" || catFull || tFull) {
          return { registrationId: reg.id, alreadyProcessed: false, newStatus: reg.status, needsRefund: true, refundReason: "Slot no longer available" };
        }
        try {
          await tx.registration.update({ where: { id: reg.id }, data: { activeKey: `${reg.categoryId}:${reg.userId}` } });
          for (const p of reg.participants) await tx.participant.update({ where: { id: p.id }, data: { activeKey: p.email ? `${reg.categoryId}:${p.email}` : null } });
          if (reg.team) await tx.team.update({ where: { id: reg.team.id }, data: { activeKey: `${reg.categoryId}:${reg.team.name.toLowerCase().replace(/\s+/g, " ").trim()}` } });
        } catch (e) {
          if (uniqueViolationTarget(e)) return { registrationId: reg.id, alreadyProcessed: false, newStatus: reg.status, needsRefund: true, refundReason: "Entry conflicts with another registration" };
          throw e;
        }
      }

      const newStatus: RegistrationStatus = reg.tournament.requiresApproval ? "PENDING_APPROVAL" : "CONFIRMED";
      await tx.registration.update({
        where: { id: reg.id },
        data: { status: newStatus, expiresAt: null, confirmedAt: newStatus === "CONFIRMED" ? new Date() : null },
      });
      if (newStatus === "CONFIRMED") await issueTicket(tx, reg.id);
      await audit({ action: "payment.confirmed", entityType: "Payment", entityId: payment.id, metadata: { via: input.via, registrationId: reg.id, amount: payment.amount } }, tx);
      return { registrationId: reg.id, alreadyProcessed: false, newStatus, needsRefund: false };
    },
    { timeout: 15_000 },
  );

  if (outcome.needsRefund) {
    await refundPayment({ paymentId: payment.id, reason: ("refundReason" in outcome && outcome.refundReason) || "Automatic refund", actorId: null }).catch((e) =>
      console.error("auto-refund failed", e),
    );
  } else if (outcome.newStatus === "CONFIRMED") {
    after(() => sendConfirmationEmails(outcome.registrationId));
  } else if (outcome.newStatus === "PENDING_APPROVAL") {
    after(() => sendRegistrationReceived(outcome.registrationId, true));
  }
  return outcome;
}

export async function markPaymentFailed(orderId: string, reason: string, paymentId?: string) {
  const payment = await db.payment.findUnique({ where: { providerOrderId: orderId }, include: { registration: { include: { tournament: true, category: true, participants: { take: 1 } } } } });
  if (!payment) return;
  const res = await db.payment.updateMany({
    where: { id: payment.id, status: { in: ["CREATED", "PENDING"] } },
    data: { status: "FAILED", failureReason: reason.slice(0, 300) },
  });
  if (res.count === 0) return;
  const r = payment.registration;
  const tpl = T.paymentFailedTemplate({
    participantName: r.participants[0]?.fullName ?? "there",
    tournamentName: r.tournament.name,
    categoryName: r.category.name,
    amount: formatMoney(payment.amount),
    retryUrl: `${env.appUrl}/dashboard/registrations/${r.id}`,
    reason,
  });
  const user = await db.user.findUnique({ where: { id: payment.userId }, select: { email: true } });
  if (user)
    await sendEmail({ dedupeKey: `payment-failed:${payment.id}:${paymentId ?? "x"}`, template: "payment_failed", to: user.email, ...tpl, userId: payment.userId, tournamentId: r.tournamentId });
}

// ─────────────────────────────────────────────────────────────
// Refunds, cancellations, approvals (admin)
// ─────────────────────────────────────────────────────────────

export async function refundPayment({ paymentId, amount, reason, actorId }: { paymentId: string; amount?: number; reason: string; actorId: string | null }) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || !payment.providerPaymentId) throw new RegistrationError("Payment not found or not captured.");
  if (!["PAID", "PARTIALLY_REFUNDED"].includes(payment.status)) throw new RegistrationError("Only captured payments can be refunded.");
  const refundable = payment.amount - payment.refundedAmount;
  const amt = amount ?? refundable;
  if (amt <= 0 || amt > refundable) throw new RegistrationError(`Refund amount must be between ₹1 and ${formatMoney(refundable)}.`);

  // Reserve the amount first so double-clicks can't over-refund.
  const reserved = await db.payment.updateMany({
    where: { id: payment.id, refundedAmount: payment.refundedAmount },
    data: { refundedAmount: { increment: amt }, status: "REFUND_PENDING" },
  });
  if (reserved.count === 0) throw new RegistrationError("Another refund is in progress. Refresh and try again.");

  const refund = await db.refund.create({ data: { paymentId: payment.id, amount: amt, reason, initiatedById: actorId, status: "PENDING" } });
  try {
    const r = await createRefund(payment.providerPaymentId, amt, { reason: reason.slice(0, 200), refund: refund.id });
    const fully = payment.refundedAmount + amt >= payment.amount;
    await db.$transaction([
      db.refund.update({ where: { id: refund.id }, data: { providerRefundId: r.id, status: r.status === "processed" ? "PROCESSED" : "PENDING", processedAt: r.status === "processed" ? new Date() : null } }),
      db.payment.update({ where: { id: payment.id }, data: { status: fully ? "REFUNDED" : "PARTIALLY_REFUNDED" } }),
    ]);
    await audit({ actorId, action: "payment.refund", entityType: "Payment", entityId: payment.id, metadata: { amount: amt, reason, refundId: r.id } });
    return { amount: amt };
  } catch (e) {
    await db.$transaction([
      db.refund.update({ where: { id: refund.id }, data: { status: "FAILED" } }),
      db.payment.update({ where: { id: payment.id }, data: { refundedAmount: { decrement: amt }, status: payment.status } }),
    ]);
    throw new RegistrationError(`Refund failed: ${e instanceof Error ? e.message : "gateway error"}`);
  }
}

async function releaseSlot(tx: Prisma.TransactionClient, registrationId: string, status: "CANCELLED" | "REJECTED", note?: string) {
  const reg = await tx.registration.update({
    where: { id: registrationId },
    data: { status, activeKey: null, cancelledAt: new Date(), adminNote: note ?? undefined },
  });
  await tx.participant.updateMany({ where: { registrationId }, data: { activeKey: null } });
  if (reg.teamId) await tx.team.update({ where: { id: reg.teamId }, data: { activeKey: null } });
  await tx.ticket.updateMany({ where: { registrationId, revokedAt: null }, data: { revokedAt: new Date() } });
  return reg;
}

export async function cancelRegistration(actor: SessionUser, registrationId: string, opts: { reason: string; refund: boolean; status?: "CANCELLED" | "REJECTED" }) {
  const status = opts.status ?? "CANCELLED";
  const reg = await db.registration.findUnique({ where: { id: registrationId }, include: { payments: { where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } } } });
  if (!reg) throw new RegistrationError("Registration not found.");
  if (reg.status === "CANCELLED" || reg.status === "REJECTED") throw new RegistrationError("Registration is already closed.");
  const inBracket = await db.match.count({ where: { OR: [{ entryAId: reg.id }, { entryBId: reg.id }] } });
  if (inBracket > 0) throw new RegistrationError("This entry is already in the fixtures. Withdraw it from the bracket first (record a walkover), then cancel.");

  await db.$transaction(async (tx) => {
    await releaseSlot(tx, reg.id, status, opts.reason);
    await tx.payment.updateMany({ where: { registrationId: reg.id, status: { in: ["CREATED", "PENDING"] } }, data: { status: "FAILED", failureReason: "Registration cancelled" } });
    await audit({ actorId: actor.id, action: `registration.${status.toLowerCase()}`, entityType: "Registration", entityId: reg.id, metadata: { reason: opts.reason, refund: opts.refund } }, tx);
  });

  let refundLine: string | null = null;
  if (opts.refund) {
    for (const p of reg.payments) {
      const r = await refundPayment({ paymentId: p.id, reason: opts.reason || status, actorId: actor.id });
      refundLine = `A refund of ${formatMoney(r.amount)} has been initiated to your original payment method. It usually reflects within 5–7 working days.`;
    }
  }
  await sendStatusEmail(reg.id, status, opts.reason, refundLine);
}

export async function approveRegistration(actor: SessionUser, registrationId: string) {
  const updated = await db.$transaction(async (tx) => {
    const res = await tx.registration.updateMany({ where: { id: registrationId, status: "PENDING_APPROVAL" }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
    if (res.count === 0) throw new RegistrationError("Only registrations awaiting approval can be approved.");
    await issueTicket(tx, registrationId);
    await audit({ actorId: actor.id, action: "registration.approved", entityType: "Registration", entityId: registrationId }, tx);
    return true;
  });
  if (updated) after(() => sendConfirmationEmails(registrationId));
}

// ─────────────────────────────────────────────────────────────
// Emails
// ─────────────────────────────────────────────────────────────

export async function registrationEmailData(registrationId: string) {
  const reg = await db.registration.findUnique({ where: { id: registrationId }, include: { ...ticketInclude, user: { select: { email: true, name: true } } } });
  if (!reg) return null;
  const t = reg.tournament;
  const start = t.matchStartTime ? (() => {
    const [h, m] = t.matchStartTime.split(":").map(Number);
    const mins = (h ?? 0) * 60 + (m ?? 0) - t.reportingMinutesBefore;
    const hh = Math.floor(((mins % 1440) + 1440) % 1440 / 60);
    const mm = ((mins % 60) + 60) % 60;
    return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
  })() : null;
  const data: T.RegistrationEmailData = {
    participantName: reg.participants[0]?.fullName ?? reg.user.name ?? "there",
    teamName: reg.team?.name,
    categoryName: reg.category.name,
    tournamentName: t.name,
    tournamentDate: formatDate(t.startDate, { weekday: "long" }),
    venueName: t.venue?.name,
    venueAddress: t.venue ? `${t.venue.addressLine}, ${t.venue.city}` : null,
    mapsUrl: mapsLink(t.venue),
    bannerUrl: t.bannerUrl,
    registrationCode: reg.code,
    amount: reg.amount === 0 ? "Free" : formatMoney(reg.amount),
    ticketUrl: `${env.appUrl}/dashboard/registrations/${reg.id}`,
    ticketNumber: reg.ticket?.number,
    reportingTime: start ? `${start} (${t.reportingMinutesBefore} min before first match)` : null,
    instructions: t.participantInstructions || DEFAULT_INSTRUCTIONS,
    organiserLine: t.organiser ? `Contact ${t.organiser.name} at ${t.organiser.phone} or ${t.organiser.email}` : null,
  };
  // Recipients: the account holder + every listed participant (deduplicated).
  const recipients = new Map<string, string>();
  recipients.set(reg.user.email.toLowerCase(), data.participantName);
  for (const p of reg.participants) if (p.email && !recipients.has(p.email.toLowerCase())) recipients.set(p.email.toLowerCase(), p.fullName);
  return { reg, data, recipients };
}

export async function sendConfirmationEmails(registrationId: string) {
  const x = await registrationEmailData(registrationId);
  if (!x || x.reg.status !== "CONFIRMED") return;
  for (const [to, name] of x.recipients) {
    const tpl = T.ticketTemplate({ ...x.data, participantName: name });
    await sendEmail({
      dedupeKey: `ticket:${registrationId}:${to}`,
      template: "ticket",
      to,
      ...tpl,
      replyTo: x.reg.tournament.emailReplyTo ?? x.reg.tournament.organiser?.email,
      fromName: x.reg.tournament.emailSenderName,
      userId: to === x.reg.user.email.toLowerCase() ? x.reg.userId : null,
      tournamentId: x.reg.tournamentId,
      meta: { ticketRegistrationId: registrationId },
      attachments: async () => {
        const pdf = await renderTicketPdf(registrationId);
        return pdf ? [{ filename: pdf.filename, content: Buffer.from(pdf.bytes), contentType: "application/pdf" }] : [];
      },
    });
  }
}

export async function sendRegistrationReceived(registrationId: string, awaitingApproval: boolean) {
  const x = await registrationEmailData(registrationId);
  if (!x) return;
  const tpl = T.registrationReceivedTemplate({ ...x.data, awaitingApproval });
  await sendEmail({ dedupeKey: `reg-received:${registrationId}:${awaitingApproval}`, template: "registration_received", to: x.reg.user.email, ...tpl, userId: x.reg.userId, tournamentId: x.reg.tournamentId });
}

async function sendStatusEmail(registrationId: string, status: "CANCELLED" | "REJECTED", reason?: string, refundLine?: string | null) {
  const x = await registrationEmailData(registrationId);
  if (!x) return;
  for (const [to, name] of x.recipients) {
    const tpl = T.registrationStatusTemplate({ participantName: name, tournamentName: x.data.tournamentName, categoryName: x.data.categoryName, status, reason, refundLine, url: x.data.ticketUrl });
    await sendEmail({ dedupeKey: `reg-status:${registrationId}:${status}:${to}`, template: "registration_status", to, ...tpl, tournamentId: x.reg.tournamentId });
  }
}
