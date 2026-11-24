import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AuthzError } from "@/lib/authz";
import { env } from "@/lib/env";
import { RegistrationError } from "@/server/registrations";
import { FixtureError } from "@/server/fixtures";

/** CSRF defence for JSON route handlers that rely on the session cookie. */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser client; SameSite=Lax cookies are not sent cross-site anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let ok = false;
  try {
    const o = new URL(origin);
    ok = o.host === host || o.origin === new URL(env.appUrl).origin;
  } catch {
    ok = false;
  }
  if (!ok) throw new AuthzError(403, "Cross-origin request blocked.");
}

export function isUserFacingError(e: unknown): e is RegistrationError | FixtureError | AuthzError {
  return e instanceof RegistrationError || e instanceof FixtureError || e instanceof AuthzError;
}

export function jsonError(e: unknown) {
  if (e instanceof AuthzError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof RegistrationError) return NextResponse.json({ error: e.message, fieldErrors: e.fieldErrors }, { status: 400 });
  if (e instanceof FixtureError) return NextResponse.json({ error: e.message }, { status: 400 });
  if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
