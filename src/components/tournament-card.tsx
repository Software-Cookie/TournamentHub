import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, CalendarDays, Clock, MapPin, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { isPremiumEvent } from "@/lib/pricing";
import { CourtArt } from "@/components/court-art";
import { SportIcon } from "@/components/sport-icon";
import { formatDate, formatMoney } from "@/lib/utils";
import type { TournamentCardData } from "@/server/queries/tournaments";

export function TournamentCard({ t, priority }: { t: TournamentCardData; priority?: boolean }) {
  const fee = t.minFee === t.maxFee ? formatMoney(t.minFee) : `${formatMoney(t.minFee)}+`;
  const lowSlots = t.slotsLeft != null && t.capacity != null && t.slotsLeft <= Math.max(5, t.capacity * 0.15);
  return (
    <Link
      href={`/tournaments/${t.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lift focus-visible:-translate-y-1"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-navy">
        {t.bannerUrl ? (
          <Image src={t.bannerUrl} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" priority={priority} />
        ) : (
          <CourtArt seed={t.slug} className="transition-transform duration-700 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/10 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge tone={t.phase.tone === "red" ? "red" : t.phase.tone === "orange" ? "orange" : t.phase.tone === "green" ? "green" : t.phase.tone === "blue" ? "blue" : "gray"} dot={t.phase.key === "ongoing"} className="bg-white/95">
            {t.phase.label}
          </Badge>
          {isPremiumEvent(t.prizePool) && <PremiumBadge />}
          {t.isDemo && <Badge tone="dark" className="bg-navy/80 text-white/80">Sample</Badge>}
        </div>
        <div className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-navy/70 text-white opacity-0 transition group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </div>
        <div className="absolute inset-x-4 bottom-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-accent-400"><SportIcon sport={t.sportSlug} className="size-4" /> {t.sport}<span className="font-semibold text-white/70">{t.formats.length ? ` — ${t.formats.join(", ")}` : ""}</span></p>
          <h3 className="mt-0.5 line-clamp-2 text-lg font-extrabold leading-tight text-white">{t.name}</h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
          <Info icon={<CalendarDays className="size-4" />} label="Date" value={formatDate(t.startDate, { weekday: "short", day: "numeric", month: "short" })} />
          <Info icon={<MapPin className="size-4" />} label="Location" value={t.city ?? "TBA"} />
          <Info icon={<Clock className="size-4" />} label="Entries close" value={formatDate(t.registrationClosesAt, { day: "numeric", month: "short" })} />
          <Info
            icon={<Users className="size-4" />}
            label="Slots"
            value={t.slotsLeft == null ? "Open" : t.slotsLeft === 0 ? "Full" : `${t.slotsLeft} left`}
            highlight={lowSlots && t.phase.key !== "completed"}
          />
        </dl>
        {t.topPrize && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-600">
            <Trophy className="size-4 shrink-0" />
            <span className="truncate">{t.prizePool > 0 ? `${formatMoney(t.prizePool)} prize pool` : t.topPrize}</span>
          </div>
        )}
        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="text-xs text-subtle">Entry fee</p>
            <p className="text-xl font-extrabold tracking-tight">{t.minFee === 0 ? "Free" : fee}</p>
          </div>
          <span className="rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white transition-colors group-hover:bg-brand">View details</span>
        </div>
      </div>
    </Link>
  );
}

function Info({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="text-subtle">{icon}</span>
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className={highlight ? "truncate font-bold text-accent-600" : "truncate font-semibold text-ink"}>{value}</dd>
      </div>
    </div>
  );
}

export function TournamentCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="skeleton aspect-[16/9] rounded-none" />
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-5" />
          ))}
        </div>
        <div className="skeleton h-9" />
        <div className="flex justify-between">
          <div className="skeleton h-9 w-24" />
          <div className="skeleton h-9 w-28" />
        </div>
      </div>
    </div>
  );
}
