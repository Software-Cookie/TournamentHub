"use client";

import { Button } from "@/components/ui";
import { openAuthModal } from "@/components/auth/auth-modal";

export function HostSignIn() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button variant="accent" onClick={() => openAuthModal("signup")}>Create free account</Button>
      <Button variant="secondary" onClick={() => openAuthModal("login")}>I have an account</Button>
    </div>
  );
}
