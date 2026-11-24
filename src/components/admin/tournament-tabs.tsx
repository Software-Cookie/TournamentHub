"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function TournamentTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const base = `/manage/tournaments/${id}`;
  const tab = sp.get("tab") ?? "details";
  const items = [
    { href: `${base}?tab=details`, label: "Details", active: pathname === base && tab === "details" },
    { href: `${base}?tab=categories`, label: "Categories", active: pathname === base && tab === "categories" },
    { href: `${base}?tab=prizes`, label: "Prizes", active: pathname === base && tab === "prizes" },
    { href: `${base}?tab=media`, label: "Images & sponsors", active: pathname === base && tab === "media" },
    { href: `${base}?tab=questions`, label: "Form questions", active: pathname === base && tab === "questions" },
    { href: `${base}/registrations`, label: "Registrations", active: pathname.startsWith(`${base}/registrations`) },
    { href: `${base}/fixtures`, label: "Fixtures", active: pathname.startsWith(`${base}/fixtures`) },
    { href: `${base}/finance`, label: "Finance", active: pathname.startsWith(`${base}/finance`) },
  ];
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-line pb-px" aria-label="Tournament sections">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={cn("relative whitespace-nowrap rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition", i.active ? "text-ink" : "text-subtle hover:text-ink")}>
          {i.label}
          {i.active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
        </Link>
      ))}
    </nav>
  );
}
