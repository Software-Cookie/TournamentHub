"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, MailCheck } from "lucide-react";
import { Button, Field } from "@/components/ui";
import { forgotPasswordAction, googleSignInAction, loginAction, resendVerificationAction, resetPasswordAction, signUpAction } from "@/server/actions/auth";
import type { ActionResult } from "@/lib/validation";
import { toast } from "sonner";

function FormError({ state }: { state: ActionResult | null }) {
  if (!state || state.ok) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
      {state.error}
    </div>
  );
}

function fe(state: ActionResult | null, key: string) {
  return state && !state.ok ? state.fieldErrors?.[key] : undefined;
}

function PasswordInput({ id, name, invalid, autoComplete }: { id: string; name: string; invalid?: boolean; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} name={name} type={show ? "text" : "password"} required className="input pr-11" aria-invalid={invalid || undefined} autoComplete={autoComplete} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-subtle hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function GoogleButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <form action={googleSignInAction}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
      <Button type="submit" variant="secondary" className="w-full">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        Continue with Google
      </Button>
    </form>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-subtle">
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function LoginForm({ callbackUrl, googleEnabled, onSwitch }: { callbackUrl?: string; googleEnabled: boolean; onSwitch?: () => void }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const [resending, startResend] = useTransition();
  const unverified = fe(state, "_unverified");
  return (
    <div>
      {googleEnabled && (
        <>
          <GoogleButton callbackUrl={callbackUrl} />
          <Divider />
        </>
      )}
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
        <FormError state={state} />
        {unverified && (
          <button
            type="button"
            disabled={resending}
            className="text-sm font-semibold text-brand hover:underline"
            onClick={() =>
              startResend(async () => {
                const r = await resendVerificationAction(unverified);
                if (r.ok) toast.success(r.message);
                else toast.error(r.error);
              })
            }
          >
            {resending ? "Sending…" : "Resend verification email"}
          </button>
        )}
        <Field label="Email" htmlFor="login-email" error={fe(state, "email")}>
          <input id="login-email" name="email" type="email" autoComplete="email" required className="input" aria-invalid={!!fe(state, "email") || undefined} />
        </Field>
        <Field label="Password" htmlFor="login-password" error={fe(state, "password")}>
          <PasswordInput id="login-password" name="password" autoComplete="current-password" invalid={!!fe(state, "password")} />
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-semibold text-brand hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={pending} className="w-full" size="lg">
          Sign in
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        New here?{" "}
        {onSwitch ? (
          <button type="button" onClick={onSwitch} className="font-semibold text-brand hover:underline">
            Create an account
          </button>
        ) : (
          <Link href={`/register${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="font-semibold text-brand hover:underline">
            Create an account
          </Link>
        )}
      </p>
    </div>
  );
}

export function SignUpForm({ callbackUrl, googleEnabled, onSwitch }: { callbackUrl?: string; googleEnabled: boolean; onSwitch?: () => void }) {
  const [state, action, pending] = useActionState(signUpAction, null);
  if (state?.ok && state.data?.autoVerified) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-green-50 text-success">
          <CheckCircle2 className="size-7" />
        </div>
        <h3 className="text-lg font-bold">Account created</h3>
        <p className="mt-2 text-sm text-muted">{state.message}</p>
        {onSwitch ? (
          <Button className="mt-5 w-full" onClick={onSwitch}>Sign in now</Button>
        ) : (
          <Link href={`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand font-semibold text-white hover:bg-brand-700">
            Sign in now
          </Link>
        )}
      </div>
    );
  }
  if (state?.ok) {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-green-50 text-success">
          <MailCheck className="size-7" />
        </div>
        <h3 className="text-lg font-bold">Check your inbox</h3>
        <p className="mt-2 text-sm text-muted">{state.message}</p>
      </div>
    );
  }
  return (
    <div>
      {googleEnabled && (
        <>
          <GoogleButton callbackUrl={callbackUrl} />
          <Divider />
        </>
      )}
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/dashboard"} />
        <FormError state={state} />
        <Field label="Full name" htmlFor="su-name" error={fe(state, "name")}>
          <input id="su-name" name="name" autoComplete="name" required className="input" aria-invalid={!!fe(state, "name") || undefined} />
        </Field>
        <Field label="Email" htmlFor="su-email" error={fe(state, "email")}>
          <input id="su-email" name="email" type="email" autoComplete="email" required className="input" aria-invalid={!!fe(state, "email") || undefined} />
        </Field>
        <Field label="Password" htmlFor="su-password" error={fe(state, "password")} hint="At least 8 characters, with a letter and a number.">
          <PasswordInput id="su-password" name="password" autoComplete="new-password" invalid={!!fe(state, "password")} />
        </Field>
        <Button type="submit" loading={pending} className="w-full" size="lg" variant="accent">
          Create account
        </Button>
        <p className="text-center text-xs text-subtle">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account?{" "}
        {onSwitch ? (
          <button type="button" onClick={onSwitch} className="font-semibold text-brand hover:underline">
            Sign in
          </button>
        ) : (
          <Link href={`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`} className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        )}
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, null);
  if (state?.ok)
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-success" />
        <p className="text-sm text-muted">{state.message}</p>
        <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <Field label="Email" htmlFor="fp-email" error={fe(state, "email")}>
        <input id="fp-email" name="email" type="email" autoComplete="email" required className="input" />
      </Field>
      <Button type="submit" loading={pending} className="w-full" size="lg">
        Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, null);
  if (state?.ok)
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-success" />
        <p className="text-sm text-muted">{state.message}</p>
        <Link href="/login" className="mt-5 inline-block font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </div>
    );
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormError state={state} />
      <Field label="New password" htmlFor="rp-pw" error={fe(state, "password")} hint="At least 8 characters, with a letter and a number.">
        <PasswordInput id="rp-pw" name="password" autoComplete="new-password" invalid={!!fe(state, "password")} />
      </Field>
      <Field label="Confirm password" htmlFor="rp-confirm" error={fe(state, "confirm")}>
        <PasswordInput id="rp-confirm" name="confirm" autoComplete="new-password" invalid={!!fe(state, "confirm")} />
      </Field>
      <Button type="submit" loading={pending} className="w-full" size="lg">
        Update password
      </Button>
    </form>
  );
}
