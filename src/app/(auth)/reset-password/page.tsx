import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Choose a new password</h1>
      <p className="mb-7 mt-1.5 text-muted">You&apos;ll be signed out of other devices after resetting.</p>
      <div className="card p-6">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="text-sm text-muted">
            This link is missing its token. <Link href="/forgot-password" className="font-semibold text-brand">Request a new link</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
