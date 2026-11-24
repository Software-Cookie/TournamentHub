import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AuthzError } from "@/lib/authz";
import { zodFieldErrors, type ActionResult } from "@/lib/validation";
import { RegistrationError } from "@/server/registrations";
import { FixtureError } from "@/server/fixtures";

/** A business-rule failure whose message is safe to show to the user. */
export class ActionError extends Error {}

/** Run a server action body and convert known failures into a typed ActionResult. Unknown errors never leak details. */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof AuthzError || e instanceof RegistrationError || e instanceof FixtureError || e instanceof ActionError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(e) };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "That value is already in use (it must be unique)." };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return { ok: false, error: "That item no longer exists. Refresh the page." };
    console.error("[action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
