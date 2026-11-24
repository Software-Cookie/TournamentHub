import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/authz";
import { googleEnabled } from "@/auth";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "This email is already registered with a password. Sign in with your password.",
  AccessDenied: "Access denied.",
  Configuration: "Sign-in is temporarily unavailable. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  const sp = await searchParams;
  const cb = sp.callbackUrl?.startsWith("/") && !sp.callbackUrl.startsWith("//") ? sp.callbackUrl : "/dashboard";
  if (await getCurrentUser()) redirect(cb);
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mb-7 mt-1.5 text-muted">Sign in to manage your registrations, tickets and matches.</p>
      {sp.error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{ERRORS[sp.error] ?? "Sign-in failed. Please try again."}</div>}
      <div className="card p-6">
        <LoginForm callbackUrl={cb} googleEnabled={googleEnabled} />
      </div>
    </div>
  );
}
