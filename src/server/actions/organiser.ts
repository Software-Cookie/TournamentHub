"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { assertUser, getMemberOrgIds } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/lib/validation";
import { ActionError, run } from "@/server/action-utils";

const orgSchema = z.object({
  name: z.string().trim().min(3, "Enter your organisation or club name").max(80).regex(/^[^<>{}$\\]*$/, "Invalid characters"),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email"),
  contactPhone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^\+?\d{10,14}$/, "Enter a valid phone number")),
  city: z.string().trim().min(2, "Enter your city").max(60),
  about: z.string().trim().max(500).optional().transform((v) => v || null),
  payoutUpi: z.string().trim().max(80).optional().transform((v) => v || null),
  payoutAccount: z.string().trim().max(300).optional().transform((v) => v || null),
});

export async function createOrganisationAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    const user = await assertUser();
    if ((await getMemberOrgIds(user.id)).length > 0) throw new ActionError("You already have an organiser profile.");
    if (!(await rateLimit(`create-org:${user.id}`, 3, 3600))) throw new ActionError("Please try again later.");
    const d = orgSchema.parse(Object.fromEntries(form));
    const base = slugify(d.name) || "organiser";
    let slug = base;
    for (let i = 2; await db.organisation.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
    await db.$transaction(async (tx) => {
      const org = await tx.organisation.create({ data: { ...d, slug, plan: "FREE" } });
      await tx.organisationMember.create({ data: { organisationId: org.id, userId: user.id, role: "OWNER" } });
      await audit({ actorId: user.id, action: "organisation.created", entityType: "Organisation", entityId: org.id }, tx);
    });
    revalidatePath("/manage", "layout");
    return undefined;
  }, "Organiser profile created.");
  // Redirect from the server: the /host page re-renders immediately, so a client-side redirect could be lost.
  if (result.ok) redirect("/manage/tournaments/new");
  return result;
}

export async function updateOrganisationAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await assertUser();
    const member = await db.organisationMember.findFirst({ where: { userId: user.id, role: { in: ["OWNER", "MANAGER"] } } });
    if (!member) throw new ActionError("Only the organisation owner can edit these details.");
    const d = orgSchema.parse(Object.fromEntries(form));
    await db.organisation.update({ where: { id: member.organisationId }, data: d });
    await audit({ actorId: user.id, action: "organisation.updated", entityType: "Organisation", entityId: member.organisationId });
    revalidatePath("/manage/settings");
    return undefined;
  }, "Organiser profile saved.");
}
