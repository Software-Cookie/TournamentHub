"use server";

/**
 * Organiser-console actions. Every action resolves the tournament that the target entity belongs to
 * and verifies — server-side — that the signed-in user may manage it (platform admin, or a member of
 * the tournament's organisation). IDs from the client are never trusted on their own.
 */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { ImageKind, MatchStatus, NotificationAudience, PrizeType } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCanManageTournament, assertUser, getMemberOrgIds, isAdminRole } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { getSportDef } from "@/lib/sports";
import { slugify } from "@/lib/utils";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/validation";
import { ActionError, run } from "@/server/action-utils";
import { approveRegistration, cancelRegistration, refundPayment, sendConfirmationEmails } from "@/server/registrations";
import { correctResult, generateFixtures, recordResult, resetFixtures, saveManualDraw, setMatchStatus, setSeeds, updateMatchSchedule } from "@/server/fixtures";
import { sendBroadcast } from "@/server/notifications";
import type { DrawMode } from "@/lib/bracket";

// ─── Ownership resolution ────────────────────────────────────

const tOf = {
  category: async (id: string) => (await db.tournamentCategory.findUnique({ where: { id }, select: { tournamentId: true } }))?.tournamentId,
  match: async (id: string) => (await db.match.findUnique({ where: { id }, select: { tournamentId: true } }))?.tournamentId,
  registration: async (id: string) => (await db.registration.findUnique({ where: { id }, select: { tournamentId: true } }))?.tournamentId,
  payment: async (id: string) => (await db.payment.findUnique({ where: { id }, select: { tournamentId: true } }))?.tournamentId,
  prize: async (id: string) => (await db.prize.findUnique({ where: { id }, select: { tournamentId: true } }))?.tournamentId,
  image: async (id: string) => (await db.tournamentImage.findUnique({ where: { id }, select: { tournamentId: true } }))?.tournamentId,
  sponsor: async (id: string) => (await db.sponsor.findUnique({ where: { id }, select: { tournamentId: true } }))?.tournamentId,
  ticket: async (id: string) => (await db.ticket.findUnique({ where: { id }, select: { registration: { select: { tournamentId: true } } } }))?.registration.tournamentId,
};

const refresh = (tournamentId: string) => revalidatePath(`/manage/tournaments/${tournamentId}`, "layout");

// ─── Shared parsers ──────────────────────────────────────────

/** "2026-12-20T08:00" (entered in IST) → Date */
const istDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time")
  .transform((s) => new Date(`${s}:00+05:30`));
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const rupees = z.coerce.number().min(0, "Must be 0 or more").max(1_000_000).transform((v) => Math.round(v * 100));
const safeUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null)
  .refine((v) => !v || v.startsWith("/uploads/") || v.startsWith("https://"), "Use an uploaded image or an https link");

// ─── Tournaments ─────────────────────────────────────────────

const tournamentSchema = z
  .object({
    name: z.string().trim().min(4, "Name is too short").max(120),
    slug: z.string().trim().max(80).optional(),
    tagline: optText(160),
    description: z.string().trim().min(20, "Add a description (20+ characters)").max(10000),
    sportId: z.string().min(1, "Choose a sport"),
    startDate: istDateTime,
    endDate: z.string().optional().transform((s) => (s && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? new Date(`${s}:00+05:30`) : null)),
    registrationOpensAt: istDateTime,
    registrationClosesAt: istDateTime,
    matchStartTime: z.string().regex(/^(\d{2}:\d{2})?$/).optional().transform((v) => v || null),
    reportingMinutesBefore: z.coerce.number().int().min(0).max(180).default(15),
    entryFee: rupees,
    maxParticipants: z.string().optional().transform((v) => (v ? Math.max(1, parseInt(v, 10)) : null)),
    requiresApproval: z.string().optional().transform((v) => v === "on"),
    allowMultipleCategories: z.string().optional().transform((v) => v === "on"),
    isFeatured: z.string().optional().transform((v) => v === "on"),
    rules: optText(10000),
    terms: optText(10000),
    refundPolicy: optText(10000),
    participantInstructions: optText(2000),
    reminderOffsetsHours: z.string().optional().transform((v) => (v ?? "24,3").split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 336)),
    emailSenderName: optText(60),
    emailReplyTo: z.string().trim().email().optional().or(z.literal("")).transform((v) => v || null),
    bannerUrl: safeUrl,
    venueName: z.string().trim().min(2, "Venue name is required").max(120),
    venueAddress: z.string().trim().min(4, "Address is required").max(300),
    venueCity: z.string().trim().min(2, "City is required").max(60),
    venueState: optText(60),
    venuePostal: optText(12),
    venueMapUrl: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")).transform((v) => v || null),
    venueLat: z.string().optional().transform((v) => (v && !Number.isNaN(Number(v)) ? Number(v) : null)),
    venueLng: z.string().optional().transform((v) => (v && !Number.isNaN(Number(v)) ? Number(v) : null)),
    organiserName: z.string().trim().min(2, "Organiser name is required").max(120),
    organiserEmail: z.string().trim().email("Enter a valid email"),
    organiserPhone: z.string().trim().min(8, "Enter a phone number").max(20),
    organiserLogoUrl: safeUrl,
  })
  .refine((d) => d.registrationClosesAt > d.registrationOpensAt, { message: "Closing must be after opening", path: ["registrationClosesAt"] })
  .refine((d) => d.registrationClosesAt <= d.startDate, { message: "Registration must close before the tournament starts", path: ["registrationClosesAt"] });

export async function saveTournamentAction(id: string | null, _: ActionResult<{ id: string }> | null, form: FormData): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const user = id ? await assertCanManageTournament(id) : await assertUser();
    const admin = isAdminRole(user.role);
    if (!id && !(await rateLimit(`create-tournament:${user.id}`, 20, 3600))) throw new ActionError("You're creating tournaments too quickly. Try again later.");
    const d = tournamentSchema.parse(Object.fromEntries(form));
    const sport = await db.sport.findUnique({ where: { id: d.sportId } });
    if (!sport || !sport.isActive) throw new ActionError("That sport isn't available.");

    // Which organisation owns a new tournament?
    let organisationId: string | null = null;
    if (!id) {
      const orgIds = await getMemberOrgIds(user.id);
      if (admin) organisationId = (await db.organisation.findUnique({ where: { slug: "tournamenthub" } }))?.id ?? orgIds[0] ?? null;
      else if (orgIds[0]) organisationId = orgIds[0];
      else throw new ActionError("Set up your organiser profile first.");
    }
    let slug = slugify(d.slug || d.name) || `tournament-${Date.now()}`;

    const tData = {
      name: d.name,
      tagline: d.tagline,
      description: d.description,
      sportId: d.sportId,
      startDate: d.startDate,
      endDate: d.endDate,
      registrationOpensAt: d.registrationOpensAt,
      registrationClosesAt: d.registrationClosesAt,
      matchStartTime: d.matchStartTime,
      reportingMinutesBefore: d.reportingMinutesBefore,
      entryFee: d.entryFee,
      maxParticipants: d.maxParticipants,
      requiresApproval: d.requiresApproval,
      allowMultipleCategories: d.allowMultipleCategories,
      rules: d.rules,
      terms: d.terms,
      refundPolicy: d.refundPolicy,
      participantInstructions: d.participantInstructions,
      reminderOffsetsHours: d.reminderOffsetsHours.length ? d.reminderOffsetsHours : [24, 3],
      emailSenderName: d.emailSenderName,
      emailReplyTo: d.emailReplyTo,
      bannerUrl: d.bannerUrl,
      // Featuring on the landing page is a platform decision.
      ...(admin ? { isFeatured: d.isFeatured } : {}),
    };

    const saved = await db.$transaction(async (tx) => {
      if (id) {
        const existing = await tx.tournament.findUniqueOrThrow({ where: { id } });
        if (existing.sportId !== d.sportId && existing.listingStatus === "PAID" && !admin) {
          throw new ActionError("The sport can't be changed after the listing fee is paid. Contact support if you need to switch.");
        }
        const venueData = { name: d.venueName, addressLine: d.venueAddress, city: d.venueCity, state: d.venueState, postalCode: d.venuePostal, mapUrl: d.venueMapUrl, latitude: d.venueLat, longitude: d.venueLng, organisationId: existing.organisationId };
        const organiserData = { name: d.organiserName, email: d.organiserEmail, phone: d.organiserPhone, logoUrl: d.organiserLogoUrl, organisationId: existing.organisationId };
        if (existing.venueId) await tx.venue.update({ where: { id: existing.venueId }, data: venueData });
        const venueId = existing.venueId ?? (await tx.venue.create({ data: venueData })).id;
        if (existing.organiserId) await tx.organiser.update({ where: { id: existing.organiserId }, data: organiserData });
        const organiserId = existing.organiserId ?? (await tx.organiser.create({ data: organiserData })).id;
        if (slug !== existing.slug) for (let i = 2; await tx.tournament.findFirst({ where: { slug, id: { not: id } } }); i++) slug = `${slugify(d.slug || d.name)}-${i}`;
        const t = await tx.tournament.update({ where: { id }, data: { ...tData, slug, venueId, organiserId } });
        await audit({ actorId: user.id, action: "tournament.updated", entityType: "Tournament", entityId: id }, tx);
        return t;
      }
      const venue = await tx.venue.create({ data: { name: d.venueName, addressLine: d.venueAddress, city: d.venueCity, state: d.venueState, postalCode: d.venuePostal, mapUrl: d.venueMapUrl, latitude: d.venueLat, longitude: d.venueLng, organisationId } });
      const organiser = await tx.organiser.create({ data: { name: d.organiserName, email: d.organiserEmail, phone: d.organiserPhone, logoUrl: d.organiserLogoUrl, organisationId } });
      for (let i = 2; await tx.tournament.findUnique({ where: { slug } }); i++) slug = `${slugify(d.slug || d.name)}-${i}`;
      const platformOrg = await tx.organisation.findUnique({ where: { slug: "tournamenthub" }, select: { id: true } });
      const t = await tx.tournament.create({
        data: {
          ...tData,
          slug,
          venueId: venue.id,
          organiserId: organiser.id,
          organisationId,
          createdById: user.id,
          status: "DRAFT",
          // Tournaments run by the platform itself don't pay a listing fee.
          listingStatus: admin && organisationId === platformOrg?.id ? "WAIVED" : "UNPAID",
        },
      });
      const def = getSportDef(sport.slug);
      for (const [i, c] of (def?.categories ?? []).entries()) {
        await tx.tournamentCategory.create({ data: { tournamentId: t.id, code: c.code, name: c.name, participantType: c.participantType, teamSize: c.teamSize, minTeamSize: c.minTeamSize ?? null, genderRule: c.genderRule, sortOrder: i, maxEntries: c.teamSize > 2 ? 16 : 32 } });
      }
      await audit({ actorId: user.id, action: "tournament.created", entityType: "Tournament", entityId: t.id, metadata: { sport: sport.slug } }, tx);
      return t;
    });
    revalidatePath("/manage/tournaments");
    revalidatePath(`/tournaments/${saved.slug}`);
    revalidatePath("/");
    return { id: saved.id };
  }, id ? "Tournament saved." : "Tournament created as a draft.");
}

export async function setTournamentStatusAction(id: string, status: "DRAFT" | "PUBLISHED" | "ONGOING" | "COMPLETED" | "CANCELLED" | "ARCHIVED") {
  return run(async () => {
    const user = await assertCanManageTournament(id);
    const t = await db.tournament.findUniqueOrThrow({ where: { id }, include: { categories: true, venue: true } });
    if (status === "PUBLISHED") {
      if (t.listingStatus === "UNPAID") throw new ActionError("Pay the listing fee to publish this tournament.");
      if (!t.categories.length) throw new ActionError("Add at least one category before publishing.");
      if (!t.venue) throw new ActionError("Add venue details before publishing.");
    }
    await db.tournament.update({ where: { id }, data: { status } });
    await audit({ actorId: user.id, action: `tournament.status.${status.toLowerCase()}`, entityType: "Tournament", entityId: id });
    refresh(id);
    revalidatePath(`/tournaments/${t.slug}`);
    revalidatePath("/");
  }, "Status updated.");
}

export async function deleteTournamentAction(id: string) {
  return run(async () => {
    const user = await assertCanManageTournament(id);
    const t = await db.tournament.findUniqueOrThrow({ where: { id }, select: { listingStatus: true, _count: { select: { registrations: true } } } });
    if (t._count.registrations > 0) throw new ActionError("This tournament has registrations — archive it instead (records must be kept).");
    if (t.listingStatus === "PAID") throw new ActionError("This tournament has a paid listing — archive it instead so the receipt is kept.");
    await db.$transaction(async (tx) => {
      await tx.listingFee.deleteMany({ where: { tournamentId: id, status: { in: ["CREATED", "FAILED"] } } });
      await tx.tournament.delete({ where: { id } });
      await audit({ actorId: user.id, action: "tournament.deleted", entityType: "Tournament", entityId: id }, tx);
    });
    revalidatePath("/manage/tournaments");
  }, "Tournament deleted.");
}

// ─── Categories ──────────────────────────────────────────────

const categorySchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "1–6 letters/numbers"),
    name: z.string().trim().min(2).max(60),
    teamSize: z.coerce.number().int().min(1).max(30),
    minTeamSize: z.string().optional().transform((v) => (v ? parseInt(v, 10) : null)),
    genderRule: z.enum(["OPEN", "MALE", "FEMALE", "MIXED"]),
    entryFee: z.string().optional().transform((v) => (v === undefined || v === "" ? null : Math.round(Number(v) * 100))),
    maxEntries: z.string().optional().transform((v) => (v ? parseInt(v, 10) : null)),
    minAge: z.string().optional().transform((v) => (v ? parseInt(v, 10) : null)),
    maxAge: z.string().optional().transform((v) => (v ? parseInt(v, 10) : null)),
    status: z.enum(["OPEN", "CLOSED"]).optional(),
  })
  .refine((d) => d.minTeamSize == null || (d.minTeamSize >= 1 && d.minTeamSize <= d.teamSize), { message: "Minimum must be between 1 and the squad size", path: ["minTeamSize"] })
  .refine((d) => d.entryFee == null || (d.entryFee >= 0 && d.entryFee <= 100_000_000), { message: "Enter a valid fee", path: ["entryFee"] });

export async function saveCategoryAction(tournamentId: string, categoryId: string | null, _: unknown, form: FormData) {
  return run(async () => {
    if (categoryId && (await tOf.category(categoryId)) !== tournamentId) throw new ActionError("Category not found.");
    const user = await assertCanManageTournament(tournamentId);
    const d = categorySchema.parse(Object.fromEntries(form));
    if (d.genderRule === "MIXED" && d.teamSize < 2) throw new ActionError("Mixed categories need at least 2 players per entry.");
    const data = { ...d, minTeamSize: d.teamSize > 2 ? d.minTeamSize : null, participantType: d.teamSize > 1 ? ("TEAM" as const) : ("INDIVIDUAL" as const) };
    if (categoryId) {
      const existing = await db.tournamentCategory.findUniqueOrThrow({ where: { id: categoryId }, include: { _count: { select: { registrations: true } } } });
      if (existing._count.registrations > 0 && existing.teamSize !== d.teamSize) throw new ActionError("Squad size can't change after registrations exist.");
      const { status, ...rest } = data;
      await db.tournamentCategory.update({ where: { id: categoryId }, data: { ...rest, ...(status && ["OPEN", "CLOSED"].includes(existing.status) ? { status } : {}) } });
    } else {
      const count = await db.tournamentCategory.count({ where: { tournamentId } });
      if (count >= 20) throw new ActionError("A tournament can have at most 20 categories.");
      await db.tournamentCategory.create({ data: { ...data, status: data.status ?? "OPEN", tournamentId, sortOrder: count } });
    }
    await audit({ actorId: user.id, action: categoryId ? "category.updated" : "category.created", entityType: "Tournament", entityId: tournamentId, metadata: { code: d.code } });
    refresh(tournamentId);
  }, "Category saved.");
}

export async function deleteCategoryAction(categoryId: string) {
  return run(async () => {
    const tid = await tOf.category(categoryId);
    const user = await assertCanManageTournament(tid);
    const c = await db.tournamentCategory.findUniqueOrThrow({ where: { id: categoryId }, include: { _count: { select: { registrations: true } } } });
    if (c._count.registrations > 0) throw new ActionError("This category has registrations. Close it instead.");
    await db.tournamentCategory.delete({ where: { id: categoryId } });
    await audit({ actorId: user.id, action: "category.deleted", entityType: "Tournament", entityId: c.tournamentId, metadata: { code: c.code } });
    refresh(c.tournamentId);
  }, "Category removed.");
}

// ─── Prizes ──────────────────────────────────────────────────

const prizeSchema = z.object({
  type: z.enum(["CASH", "TROPHY", "RACKET", "SPORTS_KIT", "MEDAL", "GIFT_VOUCHER", "CUSTOM"]),
  position: z.coerce.number().int().min(1).max(10),
  title: z.string().trim().min(2).max(120),
  description: optText(300),
  imageUrl: safeUrl,
  quantity: z.coerce.number().int().min(1).max(100).default(1),
  cashValue: z.string().optional().transform((v) => (v ? Math.round(Number(v) * 100) : null)),
  categoryId: z.string().optional().transform((v) => v || null),
});

async function recomputePrizePool(tournamentId: string) {
  const sum = await db.prize.aggregate({ where: { tournamentId }, _sum: { cashValue: true } });
  await db.tournament.update({ where: { id: tournamentId }, data: { prizePoolValue: sum._sum.cashValue ?? 0 } });
}

export async function savePrizeAction(tournamentId: string, prizeId: string | null, _: unknown, form: FormData) {
  return run(async () => {
    if (prizeId && (await tOf.prize(prizeId)) !== tournamentId) throw new ActionError("Prize not found.");
    const user = await assertCanManageTournament(tournamentId);
    const d = prizeSchema.parse(Object.fromEntries(form));
    if (d.categoryId && (await tOf.category(d.categoryId)) !== tournamentId) throw new ActionError("Category not found.");
    const data = { ...d, type: d.type as PrizeType };
    if (prizeId) await db.prize.update({ where: { id: prizeId }, data });
    else await db.prize.create({ data: { ...data, tournamentId } });
    await recomputePrizePool(tournamentId);
    await audit({ actorId: user.id, action: "prize.saved", entityType: "Tournament", entityId: tournamentId });
    refresh(tournamentId);
  }, "Prize saved.");
}

export async function deletePrizeAction(prizeId: string) {
  return run(async () => {
    const tid = await tOf.prize(prizeId);
    await assertCanManageTournament(tid);
    await db.prize.delete({ where: { id: prizeId } });
    await recomputePrizePool(tid!);
    refresh(tid!);
  }, "Prize removed.");
}

// ─── Images & sponsors ───────────────────────────────────────

const IMAGE_KINDS: ImageKind[] = ["BANNER", "COURT", "VENUE", "ORGANISER_LOGO", "SPONSOR", "PRIZE", "GALLERY"];

export async function addImageAction(tournamentId: string, input: { url: string; kind: ImageKind; alt?: string; publicId?: string | null }) {
  return run(async () => {
    await assertCanManageTournament(tournamentId);
    const url = safeUrl.parse(input.url);
    if (!url) throw new ActionError("Upload an image first.");
    if (!IMAGE_KINDS.includes(input.kind)) throw new ActionError("Unknown image type.");
    if ((await db.tournamentImage.count({ where: { tournamentId } })) >= 60) throw new ActionError("A tournament can have at most 60 images.");
    if (input.kind === "BANNER") await db.tournament.update({ where: { id: tournamentId }, data: { bannerUrl: url } });
    if (input.kind === "ORGANISER_LOGO") {
      const t = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
      if (t.organiserId) await db.organiser.update({ where: { id: t.organiserId }, data: { logoUrl: url } });
    }
    await db.tournamentImage.create({ data: { tournamentId, url, kind: input.kind, alt: input.alt?.slice(0, 120) ?? null, publicId: input.publicId?.slice(0, 200) ?? null } });
    refresh(tournamentId);
  }, "Image added.");
}

export async function deleteImageAction(imageId: string) {
  return run(async () => {
    const tid = await tOf.image(imageId);
    await assertCanManageTournament(tid);
    const img = await db.tournamentImage.delete({ where: { id: imageId } });
    if (img.kind === "BANNER") await db.tournament.updateMany({ where: { id: img.tournamentId, bannerUrl: img.url }, data: { bannerUrl: null } });
    refresh(img.tournamentId);
  }, "Image removed.");
}

export async function saveSponsorAction(tournamentId: string, input: { name: string; logoUrl?: string; website?: string }) {
  return run(async () => {
    await assertCanManageTournament(tournamentId);
    const d = z.object({ name: z.string().trim().min(2).max(80), logoUrl: safeUrl, website: z.string().trim().url().startsWith("http").optional().or(z.literal("")) }).parse(input);
    await db.sponsor.create({ data: { tournamentId, name: d.name, logoUrl: d.logoUrl, website: d.website || null } });
    refresh(tournamentId);
  }, "Sponsor added.");
}

export async function deleteSponsorAction(id: string) {
  return run(async () => {
    const tid = await tOf.sponsor(id);
    await assertCanManageTournament(tid);
    await db.sponsor.delete({ where: { id } });
    refresh(tid!);
  }, "Sponsor removed.");
}

const questionSchema = z
  .array(z.object({ id: z.string().regex(/^[a-z0-9_]{1,30}$/), label: z.string().trim().min(2).max(120), type: z.enum(["text", "select", "checkbox"]), required: z.boolean(), options: z.array(z.string().trim().min(1).max(60)).max(20).optional() }))
  .max(15);

export async function saveQuestionsAction(tournamentId: string, questions: unknown) {
  return run(async () => {
    await assertCanManageTournament(tournamentId);
    const q = questionSchema.parse(questions);
    await db.tournament.update({ where: { id: tournamentId }, data: { customQuestions: q } });
    refresh(tournamentId);
  }, "Registration questions saved.");
}

// ─── Registrations ───────────────────────────────────────────

export async function approveRegistrationAction(id: string) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.registration(id));
    await approveRegistration(user, id);
    revalidatePath("/manage", "layout");
  }, "Registration approved and ticket sent.");
}

export async function cancelRegistrationAction(id: string, input: { reason: string; refund: boolean; reject?: boolean }) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.registration(id));
    const reason = z.string().trim().min(3, "Give a short reason").max(300).parse(input.reason);
    await cancelRegistration(user, id, { reason, refund: !!input.refund, status: input.reject ? "REJECTED" : "CANCELLED" });
    revalidatePath("/manage", "layout");
  }, input.reject ? "Registration rejected." : "Registration cancelled.");
}

export async function refundPaymentAction(paymentId: string, input: { amountRupees?: number; reason: string }) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.payment(paymentId));
    const reason = z.string().trim().min(3).max(300).parse(input.reason);
    const amount = input.amountRupees ? Math.round(z.number().positive().max(1_000_000).parse(input.amountRupees) * 100) : undefined;
    const r = await refundPayment({ paymentId, amount, reason, actorId: user.id });
    revalidatePath("/manage", "layout");
    return r;
  }, "Refund initiated.");
}

export async function resendTicketAction(registrationId: string) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.registration(registrationId));
    if (!(await rateLimit(`resend-ticket:${registrationId}`, 3, 3600))) throw new ActionError("This ticket was re-sent recently. Try again later.");
    await db.emailLog.deleteMany({ where: { dedupeKey: { startsWith: `ticket:${registrationId}:` } } });
    await sendConfirmationEmails(registrationId);
    await audit({ actorId: user.id, action: "ticket.resent", entityType: "Registration", entityId: registrationId });
  }, "Ticket email re-sent.");
}

export async function checkInAction(ticketId: string, undo = false) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.ticket(ticketId));
    const t = await db.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { registration: true } });
    if (t.revokedAt || t.registration.status !== "CONFIRMED") throw new ActionError("This ticket is not valid.");
    await db.ticket.update({ where: { id: ticketId }, data: undo ? { checkedInAt: null, checkedInById: null } : { checkedInAt: t.checkedInAt ?? new Date(), checkedInById: user.id } });
    await audit({ actorId: user.id, action: undo ? "ticket.checkin_undone" : "ticket.checked_in", entityType: "Ticket", entityId: ticketId });
    revalidatePath("/verify", "layout");
  }, undo ? "Check-in undone." : "Checked in.");
}

// ─── Fixtures & matches ──────────────────────────────────────

const drawModes = ["SEEDED", "RANDOM", "SEQUENTIAL"] as const;

export async function generateFixturesAction(categoryId: string, input: { mode: DrawMode; thirdPlace: boolean }) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.category(categoryId));
    const mode = z.enum(drawModes).parse(input.mode);
    const r = await generateFixtures(user, categoryId, { mode, thirdPlace: !!input.thirdPlace });
    revalidatePath("/manage", "layout");
    return r;
  }, "Fixtures generated.");
}

export async function saveManualDrawAction(categoryId: string, pairs: [string | null, string | null][]) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.category(categoryId));
    const parsed = z.array(z.tuple([z.string().nullable(), z.string().nullable()])).min(1).max(64).parse(pairs);
    await saveManualDraw(user, categoryId, parsed);
    revalidatePath("/manage", "layout");
  }, "Draw saved.");
}

export async function resetFixturesAction(categoryId: string) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.category(categoryId));
    await resetFixtures(user, categoryId);
    revalidatePath("/manage", "layout");
  }, "Fixtures cleared.");
}

export async function setSeedsAction(categoryId: string, seeds: Record<string, number | null>) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.category(categoryId));
    const parsed = z.record(z.string(), z.number().int().nullable()).parse(seeds);
    await setSeeds(user, categoryId, parsed);
    revalidatePath("/manage", "layout");
  }, "Seeds saved.");
}

export async function scheduleMatchAction(matchId: string, input: { court?: string; scheduledAt?: string; notes?: string; notify?: boolean }) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.match(matchId));
    const when = input.scheduledAt ? (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.scheduledAt) ? new Date(`${input.scheduledAt}:00+05:30`) : null) : null;
    if (input.scheduledAt && !when) throw new ActionError("Invalid date/time.");
    await updateMatchSchedule(user, matchId, { court: input.court?.trim().slice(0, 30), scheduledAt: input.scheduledAt === undefined ? undefined : when, notes: input.notes?.trim().slice(0, 300), notify: input.notify });
    revalidatePath("/manage", "layout");
  }, "Match updated.");
}

const MANUAL_STATUSES: MatchStatus[] = ["SCHEDULED", "UPCOMING", "READY", "ONGOING", "POSTPONED", "CANCELLED"];

export async function setMatchStatusAction(matchId: string, status: MatchStatus, liveScore?: string) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.match(matchId));
    if (!MANUAL_STATUSES.includes(status)) throw new ActionError("Use “Complete match” to record a result.");
    await setMatchStatus(user, matchId, status, liveScore?.slice(0, 60));
    revalidatePath("/manage", "layout");
  }, "Status updated.");
}

const resultSchema = z.object({
  winnerId: z.string().min(1, "Choose the winner"),
  score: z.string().trim().min(1, "Enter the score (or 'Walkover')").max(80),
  durationMinutes: z.number().int().min(1).max(600).nullable().optional(),
  remarks: z.string().trim().max(300).nullable().optional(),
  reason: z.string().trim().max(300).optional(),
  version: z.number().int().optional(),
});

export async function recordResultAction(matchId: string, input: z.input<typeof resultSchema>, correction = false) {
  return run(async () => {
    const user = await assertCanManageTournament(await tOf.match(matchId));
    const d = resultSchema.parse(input);
    if (correction) await correctResult(user, matchId, { ...d, reason: d.reason ?? "" });
    else await recordResult(user, matchId, d, d.version);
    revalidatePath("/manage", "layout");
  }, correction ? "Result corrected." : "Result recorded — winner advanced.");
}

// ─── Communication ───────────────────────────────────────────

export async function sendBroadcastAction(input: { tournamentId: string; audience: NotificationAudience; categoryId?: string; registrationIds?: string[]; subject: string; body: string }) {
  return run(async () => {
    const user = await assertCanManageTournament(input.tournamentId);
    if (!(await rateLimit(`broadcast:${user.id}`, 10, 3600))) throw new ActionError("You've sent a lot of announcements recently. Try again in an hour.");
    const d = z
      .object({
        tournamentId: z.string().min(1),
        audience: z.enum(["ALL", "CATEGORY", "TEAM", "SELECTED"]),
        categoryId: z.string().optional(),
        registrationIds: z.array(z.string()).max(500).optional(),
        subject: z.string().trim().min(3, "Add a subject").max(120),
        body: z.string().trim().min(10, "Write a message (10+ characters)").max(5000),
      })
      .parse(input);
    if (d.categoryId && (await tOf.category(d.categoryId)) !== d.tournamentId) throw new ActionError("Category not found.");
    const r = await sendBroadcast(user, d);
    revalidatePath("/manage/notifications");
    return r;
  });
}
