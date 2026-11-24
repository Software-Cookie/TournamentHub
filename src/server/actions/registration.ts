"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { registrationSchema, zodFieldErrors, type ActionResult } from "@/lib/validation";
import { createRegistration, RegistrationError } from "@/server/registrations";

export async function createRegistrationAction(raw: unknown): Promise<ActionResult<{ id: string; status: string; amount: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to register." };
  if (!(await rateLimit(`register:${user.id}`, 15, 600))) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  try {
    const reg = await createRegistration(user, parsed.data);
    revalidatePath("/dashboard");
    return { ok: true, data: { id: reg.id, status: reg.status, amount: reg.amount } };
  } catch (e) {
    if (e instanceof RegistrationError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
    console.error(e);
    return { ok: false, error: "We couldn't complete your registration. Please try again." };
  }
}
