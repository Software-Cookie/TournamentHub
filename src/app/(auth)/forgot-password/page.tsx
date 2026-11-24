import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">Forgot your password?</h1>
      <p className="mb-7 mt-1.5 text-muted">Enter your email and we&apos;ll send you a secure link to reset it.</p>
      <div className="card p-6">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
