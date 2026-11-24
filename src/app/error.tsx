"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook point for error monitoring (e.g. Sentry.captureException(error)).
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4 text-center">
      <div>
        <p className="display text-6xl italic text-accent">Let</p>
        <h1 className="mt-2 text-2xl font-extrabold">Something went wrong — replay the point?</h1>
        <p className="mx-auto mt-2 max-w-md text-muted">An unexpected error occurred. It has been logged. {error.digest && <span className="font-mono text-xs">Ref: {error.digest}</span>}</p>
        <button onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-700">
          <RotateCcw className="size-4" /> Try again
        </button>
      </div>
    </div>
  );
}
