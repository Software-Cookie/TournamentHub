"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { after } from "next/server";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { clientIp, rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { randomToken, sha256 } from "@/lib/tokens";
import { sendEmail } from "@/lib/email/send";
import { passwordResetTemplate, verifyEmailTemplate, welcomeTemplate } from "@/lib/email/templates";
import { emailSchema, nameSchema, passwordSchema, zodFieldErrors, type ActionResult } from "@/lib/validation";

function safeRedirect(path: unknown) {
  const p = typeof path === "string" ? path : "";
  return p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") ? p : "/dashboard";
}

async function issueToken(userId: string, type: "EMAIL_VERIFICATION" | "PASSWORD_RESET", ttlMs: number) {
  const token = randomToken(32);
  // Invalidate previous unused tokens of the same type.
  await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  await db.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

async function sendVerification(user: { id: string; email: string; name: string | null }) {
  const token = await issueToken(user.id, "EMAIL_VERIFICATION", 24 * 3600_000);
  const tpl = verifyEmailTemplate(user.name, `${env.appUrl}/verify-email?token=${token}`);
  await sendEmail({ dedupeKey: `verify:${user.id}:${sha256(token).slice(0, 16)}`, template: "verify_email", to: user.email, ...tpl, userId: user.id });
}

const signUpSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema, callbackUrl: z.string().optional() });

export async function signUpAction(_: ActionResult<{ autoVerified?: boolean }> | null, form: FormData): Promise<ActionResult<{ autoVerified?: boolean }>> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  if (!(await rateLimitByIp("signup", 8, 3600))) return { ok: false, error: "Too many sign-up attempts. Please try again later." };
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.emailVerified) {
      if (await rateLimit(`verify-resend:${existing.id}`, 3, 3600)) after(() => sendVerification(existing));
      return { ok: true, message: "We've sent a verification link to your email. Open it to activate your account." };
    }
    return { ok: false, error: "An account with this email already exists. Sign in instead, or reset your password.", fieldErrors: { email: "Already registered" } };
  }
  // Development/demo only: with no email provider configured, verification links can't reach anyone,
  // so accounts are activated immediately. Never applies in production builds.
  const autoVerify = env.autoVerifySignups;
  const user = await db.user.create({ data: { name, email, passwordHash: await bcrypt.hash(password, 12), emailVerified: autoVerify ? new Date() : null } });
  await audit({ actorId: user.id, action: "user.signup", entityType: "User", entityId: user.id, ip: await clientIp(), metadata: { autoVerified: autoVerify } });
  if (autoVerify) return { ok: true, data: { autoVerified: true }, message: "Your account is ready. (Demo mode: email delivery isn't set up, so your email was verified automatically.)" };
  after(() => sendVerification(user));
  return { ok: true, message: `Almost there! We sent a verification link to ${email}. Open it to activate your account.` };
}

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(200), callbackUrl: z.string().optional() });

export async function loginAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Enter your email and password.", fieldErrors: zodFieldErrors(parsed.error) };
  const { email, password, callbackUrl } = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}:${email}`, 8, 900)) || !(await rateLimit(`login-ip:${ip}`, 40, 900))) {
    return { ok: false, error: "Too many sign-in attempts. Please wait 15 minutes and try again." };
  }
  try {
    await signIn("credentials", { email, password, redirectTo: safeRedirect(callbackUrl) });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code;
      if (code === "email_not_verified") return { ok: false, error: "Please verify your email first. We can send you a new link.", fieldErrors: { _unverified: email } };
      return { ok: false, error: "Incorrect email or password." };
    }
    throw e; // NEXT_REDIRECT on success
  }
}

export async function resendVerificationAction(email: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email." };
  if (!(await rateLimitByIp("resend-verify", 5, 3600))) return { ok: false, error: "Too many requests. Try again later." };
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user && !user.emailVerified && (await rateLimit(`verify-resend:${user.id}`, 3, 3600))) after(() => sendVerification(user));
  return { ok: true, message: "If that account needs verification, a new link is on its way." };
}

export async function verifyEmailToken(token: string) {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.type !== "EMAIL_VERIFICATION") return { ok: false as const, error: "This verification link is invalid." };
  if (row.usedAt) return { ok: row.user.emailVerified ? (true as const) : (false as const), error: "This link has already been used.", already: true };
  if (row.expiresAt < new Date()) return { ok: false as const, error: "This verification link has expired. Request a new one from the sign-in page." };
  await db.$transaction([
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: row.userId }, data: { emailVerified: row.user.emailVerified ?? new Date() } }),
  ]);
  const tpl = welcomeTemplate(row.user.name);
  await sendEmail({ dedupeKey: `welcome:${row.userId}`, template: "welcome", to: row.user.email, ...tpl, userId: row.userId });
  return { ok: true as const, error: null };
}

export async function forgotPasswordAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { ok: false, error: "Enter a valid email.", fieldErrors: { email: "Enter a valid email" } };
  if (!(await rateLimitByIp("forgot", 6, 3600))) return { ok: false, error: "Too many requests. Please try again later." };
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (user && !user.isDisabled && (await rateLimit(`forgot:${user.id}`, 3, 3600))) {
    after(async () => {
      const token = await issueToken(user.id, "PASSWORD_RESET", 3600_000);
      const tpl = passwordResetTemplate(user.name, `${env.appUrl}/reset-password?token=${token}`);
      await sendEmail({ dedupeKey: `reset:${user.id}:${sha256(token).slice(0, 16)}`, template: "password_reset", to: user.email, ...tpl, userId: user.id });
    });
  }
  // Same response whether or not the account exists (prevents account enumeration).
  return { ok: true, message: "If an account exists for that email, a reset link is on its way. It expires in 1 hour." };
}

const resetSchema = z.object({ token: z.string().min(20).max(100), password: passwordSchema, confirm: z.string() }).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function resetPasswordAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  if (!(await rateLimitByIp("reset", 10, 3600))) return { ok: false, error: "Too many attempts. Try again later." };
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(parsed.data.token) } });
  if (!row || row.type !== "PASSWORD_RESET" || row.usedAt || row.expiresAt < new Date()) {
    return { ok: false, error: "This reset link is invalid or has expired. Request a new one." };
  }
  const hash = await bcrypt.hash(parsed.data.password, 12);
  await db.$transaction([
    db.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // Bumping sessionVersion signs the user out everywhere. Reset proves email ownership, so mark verified.
    db.user.update({ where: { id: row.userId }, data: { passwordHash: hash, sessionVersion: { increment: 1 }, emailVerified: new Date() } }),
  ]);
  await audit({ actorId: row.userId, action: "user.password_reset", entityType: "User", entityId: row.userId, ip: await clientIp() });
  return { ok: true, message: "Your password has been updated. You can now sign in." };
}

export async function googleSignInAction(form: FormData) {
  await signIn("google", { redirectTo: safeRedirect(form.get("callbackUrl")) });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
