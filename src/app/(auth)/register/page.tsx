import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/forms";
import { getCurrentUser } from "@/lib/authz";
import { googleEnabled } from "@/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const sp = await searchParams;
  const cb = sp.callbackUrl?.startsWith("/") && !sp.callbackUrl.startsWith("//") ? sp.callbackUrl : "/dashboard";
  if (await getCurrentUser()) redirect(cb);
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mb-7 mt-1.5 text-muted">Join TournamentHub to register for tournaments and get your digital tickets.</p>
      <div className="card p-6">
        <SignUpForm callbackUrl={cb} googleEnabled={googleEnabled} />
      </div>
    </div>
  );
}
