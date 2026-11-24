"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nameSchema, passwordSchema, zodFieldErrors, type ActionResult } from "@/lib/validation";

const profileSchema = z.object({
  name: nameSchema,
  phone: z.string().trim().max(20).regex(/^[+\d\s()-]*$/, "Enter a valid phone number").optional(),
  city: z.string().trim().max(60).optional(),
});

export async function updateProfileAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  await db.user.update({ where: { id: user.id }, data: { name: parsed.data.name, phone: parsed.data.phone || null, city: parsed.data.city || null } });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile saved." };
}

const pwSchema = z.object({ current: z.string().max(200), password: passwordSchema, confirm: z.string() }).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function changePasswordAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  const parsed = pwSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  const dbUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (dbUser.passwordHash && !(await bcrypt.compare(parsed.data.current, dbUser.passwordHash))) {
    return { ok: false, error: "Current password is incorrect.", fieldErrors: { current: "Incorrect password" } };
  }
  // Note: bumping sessionVersion would sign this session out too; keep other sessions valid only by re-login.
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
  await audit({ actorId: user.id, action: "user.password_changed", entityType: "User", entityId: user.id });
  return { ok: true, message: "Password updated." };
}
