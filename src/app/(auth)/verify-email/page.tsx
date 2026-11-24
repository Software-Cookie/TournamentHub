import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmailToken } from "@/server/actions/auth";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Verify email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailToken(token) : { ok: false as const, error: "This verification link is incomplete." };
  return (
    <div className="card p-8 text-center">
      {result.ok ? (
        <>
          <CheckCircle2 className="mx-auto size-14 text-success" />
          <h1 className="mt-4 text-2xl font-extrabold">Email verified</h1>
          <p className="mt-2 text-muted">Your account is active. Sign in to register for tournaments.</p>
          <ButtonLink href="/login" className="mt-6 w-full" size="lg">
            Sign in
          </ButtonLink>
        </>
      ) : (
        <>
          <XCircle className="mx-auto size-14 text-danger" />
          <h1 className="mt-4 text-2xl font-extrabold">We couldn&apos;t verify that link</h1>
          <p className="mt-2 text-muted">{result.error}</p>
          <ButtonLink href="/login" variant="secondary" className="mt-6 w-full">
            Go to sign in
          </ButtonLink>
        </>
      )}
    </div>
  );
}
