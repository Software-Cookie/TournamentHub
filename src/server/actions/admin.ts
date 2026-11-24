"use server";

/** Platform-owner actions (SUPER_ADMIN / ADMIN only). Tournament operations live in ./manage.ts. */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertAdmin, AuthzError } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { ActionError, run } from "@/server/action-utils";

// ─── Users ───────────────────────────────────────────────────

export async function setUserRoleAction(userId: string, role: "PLAYER" | "ADMIN") {
  return run(async () => {
    const admin = await assertAdmin();
    if (admin.role !== "SUPER_ADMIN") throw new AuthzError(403, "Only the platform owner can change roles.");
    if (userId === admin.id) throw new ActionError("You can't change your own role.");
    if (role !== "PLAYER" && role !== "ADMIN") throw new ActionError("Unknown role.");
    const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (target.role === "SUPER_ADMIN") throw new ActionError("The platform owner's role can't be changed here.");
    await db.user.update({ where: { id: userId }, data: { role, sessionVersion: { increment: 1 } } });
    await audit({ actorId: admin.id, action: "user.role_changed", entityType: "User", entityId: userId, metadata: { from: target.role, to: role } });
    revalidatePath("/admin/users");
  }, "Role updated.");
}

export async function setUserDisabledAction(userId: string, disabled: boolean) {
  return run(async () => {
    const admin = await assertAdmin();
    if (userId === admin.id) throw new ActionError("You can't disable your own account.");
    const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (target.role !== "PLAYER" && admin.role !== "SUPER_ADMIN") throw new AuthzError(403);
    await db.user.update({ where: { id: userId }, data: { isDisabled: !!disabled, sessionVersion: { increment: 1 } } });
    await audit({ actorId: admin.id, action: disabled ? "user.disabled" : "user.enabled", entityType: "User", entityId: userId });
    revalidatePath("/admin/users");
  }, disabled ? "Account disabled." : "Account enabled.");
}

// ─── Sports & listing prices ─────────────────────────────────

export async function updateSportAction(sportId: string, input: { listingFeeRupees: number; isActive: boolean }) {
  return run(async () => {
    const admin = await assertAdmin();
    const d = z.object({ listingFeeRupees: z.number().min(0).max(1_000_000), isActive: z.boolean() }).parse(input);
    const before = await db.sport.findUniqueOrThrow({ where: { id: sportId } });
    const listingFee = Math.round(d.listingFeeRupees * 100);
    if (listingFee > 0 && listingFee < 100) throw new ActionError("A paid listing must be at least ₹1.");
    await db.sport.update({ where: { id: sportId }, data: { listingFee, isActive: d.isActive } });
    await audit({ actorId: admin.id, action: "sport.updated", entityType: "Sport", entityId: sportId, metadata: { fromFee: before.listingFee, toFee: listingFee, isActive: d.isActive } });
    revalidatePath("/admin/sports");
    revalidatePath("/");
  }, "Sport updated.");
}

export async function setListingStatusAction(tournamentId: string, status: "WAIVED" | "UNPAID") {
  return run(async () => {
    const admin = await assertAdmin();
    const t = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
    if (t.listingStatus === "PAID") throw new ActionError("This listing is already paid.");
    if (status === "UNPAID" && (t.status === "PUBLISHED" || t.status === "ONGOING")) throw new ActionError("Unpublish the tournament before removing its waiver.");
    await db.tournament.update({ where: { id: tournamentId }, data: { listingStatus: status } });
    await audit({ actorId: admin.id, action: `listing.${status.toLowerCase()}`, entityType: "Tournament", entityId: tournamentId });
    revalidatePath("/admin/organisers");
    revalidatePath(`/manage/tournaments/${tournamentId}`, "layout");
  }, status === "WAIVED" ? "Listing fee waived." : "Waiver removed.");
}

export async function setFeaturedAction(tournamentId: string, featured: boolean) {
  return run(async () => {
    const admin = await assertAdmin();
    await db.tournament.update({ where: { id: tournamentId }, data: { isFeatured: !!featured } });
    await audit({ actorId: admin.id, action: featured ? "tournament.featured" : "tournament.unfeatured", entityType: "Tournament", entityId: tournamentId });
    revalidatePath("/");
    revalidatePath("/admin/organisers");
  }, featured ? "Featured on the landing page." : "Removed from featured.");
}

// ─── Organisers & payouts ────────────────────────────────────

export async function setOrganisationActiveAction(organisationId: string, active: boolean) {
  return run(async () => {
    const admin = await assertAdmin();
    const org = await db.organisation.findUniqueOrThrow({ where: { id: organisationId } });
    if (org.slug === "tournamenthub") throw new ActionError("The platform organisation can't be suspended.");
    await db.$transaction(async (tx) => {
      await tx.organisation.update({ where: { id: organisationId }, data: { isActive: !!active } });
      if (!active) await tx.tournament.updateMany({ where: { organisationId, status: "PUBLISHED" }, data: { status: "DRAFT" } });
      await audit({ actorId: admin.id, action: active ? "organisation.reinstated" : "organisation.suspended", entityType: "Organisation", entityId: organisationId }, tx);
    });
    revalidatePath("/admin/organisers");
    revalidatePath("/");
  }, active ? "Organiser reinstated." : "Organiser suspended and their open tournaments unpublished.");
}

export async function recordPayoutAction(input: { organisationId: string; tournamentId?: string; amountRupees: number; reference: string; note?: string }) {
  return run(async () => {
    const admin = await assertAdmin();
    const d = z
      .object({
        organisationId: z.string().min(1),
        tournamentId: z.string().optional(),
        amountRupees: z.number().positive("Enter an amount").max(10_000_000),
        reference: z.string().trim().min(3, "Add the transfer reference (UTR)").max(80),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input);
    await db.organisation.findUniqueOrThrow({ where: { id: d.organisationId } });
    if (d.tournamentId) {
      const t = await db.tournament.findUnique({ where: { id: d.tournamentId }, select: { organisationId: true } });
      if (t?.organisationId !== d.organisationId) throw new ActionError("That tournament doesn't belong to this organiser.");
    }
    const p = await db.payout.create({ data: { organisationId: d.organisationId, tournamentId: d.tournamentId || null, amount: Math.round(d.amountRupees * 100), reference: d.reference, note: d.note || null, createdById: admin.id } });
    await audit({ actorId: admin.id, action: "payout.recorded", entityType: "Organisation", entityId: d.organisationId, metadata: { payoutId: p.id, amount: p.amount, reference: d.reference } });
    revalidatePath("/admin/organisers");
  }, "Payout recorded.");
}
