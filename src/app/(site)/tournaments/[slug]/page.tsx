import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CalendarDays, Clock, Gift, IndianRupee, Lock, Mail, MapPin, Medal, Navigation, Phone, ScrollText, Shirt, ShieldCheck, Sparkles, Swords, Trophy, Users } from "lucide-react";
import type { PrizeType } from "@prisma/client";
import { Badge, ButtonLink, Card } from "@/components/ui";
import { CourtArt } from "@/components/court-art";
import { Reveal } from "@/components/motion";
import { getTournamentBySlug } from "@/server/queries/tournaments";
import { podium, entryName, entryPlayers } from "@/server/fixtures";
import { canViewTournamentMatches, getCurrentUser } from "@/lib/authz";
import { GENDER_RULE_LABEL } from "@/lib/sports";
import { formatDate, formatDateTime, formatMoney, mapsEmbed, mapsLink } from "@/lib/utils";
import { DEFAULT_INSTRUCTIONS } from "@/lib/tickets";
import { isPremiumEvent } from "@/lib/pricing";
import { isPremiumUser } from "@/server/membership";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { PremiumButton } from "@/components/premium/premium-modal";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t || t.status === "DRAFT" || t.status === "ARCHIVED") return { title: "Tournament not found" };
  return { title: t.name, description: t.tagline ?? t.description.slice(0, 160), openGraph: { images: t.bannerUrl ? [t.bannerUrl] : ["/brand/logo-wide.png"] } };
}

const PRIZE_ICON: Record<PrizeType, typeof Trophy> = { CASH: IndianRupee, TROPHY: Trophy, RACKET: Swords, SPORTS_KIT: Shirt, MEDAL: Medal, GIFT_VOUCHER: Gift, CUSTOM: Sparkles };
const POS = ["", "1st", "2nd", "3rd", "4th"];

export default async function TournamentPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTournamentBySlug(slug);
  if (!t) notFound();
  const user = await getCurrentUser();
  const isAdmin = user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN");
  if ((t.status === "DRAFT" || t.status === "ARCHIVED") && !isAdmin) notFound();

  const canSeeFixtures = await canViewTournamentMatches(user, t.id);
  const premium = isPremiumEvent(t.prizePoolValue);
  // Signed-out visitors go through the normal register link (which asks them to sign in first).
  const premiumLocked = premium && !!user && !(await isPremiumUser(user.id));
  const hasFixtures = t.categories.some((c) => c.status === "DRAWN" || c.status === "IN_PROGRESS" || c.status === "COMPLETED");
  const podiums = t.status === "COMPLETED" || t.categories.some((c) => c.championId) ? (await Promise.all(t.categories.map(async (c) => ({ c, p: await podium(c.id) })))).filter((x) => x.p) : [];

  const fees = t.categoryStats.map((c) => c.fee);
  const minFee = Math.min(...fees, t.entryFee);
  const totalLeft = t.maxParticipants != null ? Math.max(0, t.maxParticipants - t.totalUsed) : t.categoryStats.every((c) => c.left != null) ? t.categoryStats.reduce((s, c) => s + (c.left ?? 0), 0) : null;
  const maps = mapsLink(t.venue);
  const embed = mapsEmbed(t.venue);
  const gallery = t.images.filter((i) => i.kind !== "BANNER" && i.kind !== "SPONSOR" && i.kind !== "PRIZE");

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-navy text-white">
        <div className="absolute inset-0 -z-10">
          {t.bannerUrl ? <Image src={t.bannerUrl} alt="" fill priority sizes="100vw" className="object-cover" /> : <CourtArt seed={t.slug} />}
          <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/75 to-navy/40" />
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-32 sm:px-6 lg:px-8 lg:pb-16 lg:pt-40">
          <div className="flex flex-wrap gap-2">
            <Badge tone={t.phase.tone === "red" ? "red" : t.phase.tone === "green" ? "green" : t.phase.tone === "orange" ? "orange" : t.phase.tone === "blue" ? "blue" : "gray"} dot={t.phase.key === "ongoing"} className="bg-white">
              {t.phase.label}
            </Badge>
            <Badge tone="dark" className="bg-white/10 ring-white/20">{t.sport.name}</Badge>
            {premium && <PremiumBadge label="Premium event" />}
            {t.isDemo && <Badge tone="dark" className="bg-white/10 ring-white/20">Sample data</Badge>}
            {t.status === "DRAFT" && <Badge tone="yellow">Draft — only visible to admins</Badge>}
          </div>
          <h1 className="display mt-4 max-w-4xl text-5xl italic sm:text-6xl lg:text-7xl">{t.name}</h1>
          {t.tagline && <p className="mt-3 max-w-2xl text-lg text-white/75">{t.tagline}</p>}
          <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-white/85">
            <span className="flex items-center gap-2"><CalendarDays className="size-4 text-accent" />{formatDate(t.startDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
            {t.venue && <span className="flex items-center gap-2"><MapPin className="size-4 text-accent" />{t.venue.name}, {t.venue.city}</span>}
            {t.matchStartTime && <span className="flex items-center gap-2"><Clock className="size-4 text-accent" />Matches from {t.matchStartTime}</span>}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="min-w-0 space-y-8">
          {/* Results */}
          {podiums.length > 0 && (
            <Section id="results" title="Results" icon={<Trophy className="size-5" />}>
              <div className="grid gap-4 sm:grid-cols-2">
                {podiums.map(({ c, p }) => (
                  <div key={c.id} className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white">
                    <p className="border-b border-amber-100 px-4 py-2.5 text-sm font-bold text-amber-800">{c.name}</p>
                    <ol className="space-y-2 p-4 text-sm">
                      <li className="flex items-center gap-2"><span className="text-lg">🥇</span><span className="font-extrabold">{entryName(p!.champion)}</span>{p!.champion.team && <span className="truncate text-xs text-subtle">({entryPlayers(p!.champion)})</span>}</li>
                      {p!.runnerUp && <li className="flex items-center gap-2"><span className="text-lg">🥈</span><span className="font-semibold">{entryName(p!.runnerUp)}</span></li>}
                      {p!.thirdPlaces.length > 0 && <li className="flex items-center gap-2"><span className="text-lg">🥉</span><span className="font-semibold">{p!.thirdPlaces.map((x) => entryName(x)).join(" · ")}</span></li>}
                    </ol>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Prizes — prominent */}
          {t.prizes.length > 0 && (
            <Reveal>
              <section id="prizes" className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white sm:p-8">
                <div className="glow-accent absolute inset-0" aria-hidden />
                <div className="relative flex items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow text-accent">What you&apos;re playing for</p>
                    <h2 className="display mt-1 text-4xl italic">Prizes</h2>
                  </div>
                  {t.prizePoolValue > 0 && (
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Cash pool</p>
                      <p className="display text-4xl text-accent">{formatMoney(t.prizePoolValue)}</p>
                    </div>
                  )}
                </div>
                <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {t.prizes.map((p) => {
                    const Icon = PRIZE_ICON[p.type];
                    return (
                      <div key={p.id} className={`rounded-2xl border p-4 ${p.position === 1 ? "border-amber-400/50 bg-gradient-to-br from-amber-400/20 to-white/5" : "border-white/10 bg-white/5"}`}>
                        <div className="flex items-start gap-3">
                          {p.imageUrl ? (
                            <Image src={p.imageUrl} alt="" width={56} height={56} className="size-14 rounded-xl object-cover" />
                          ) : (
                            <div className={`grid size-12 shrink-0 place-items-center rounded-xl ${p.position === 1 ? "bg-amber-400 text-navy" : "bg-white/10 text-accent"}`}>
                              <Icon className="size-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wider text-white/60">
                              {POS[p.position] ?? `${p.position}th`} place{p.category ? ` · ${p.category.name}` : ""}
                            </p>
                            <p className="mt-0.5 font-bold leading-snug">{p.title}</p>
                            {p.cashValue ? <p className="mt-1 text-sm font-semibold text-accent">{formatMoney(p.cashValue)}</p> : null}
                            {p.description && <p className="mt-1 text-xs text-white/60">{p.description}</p>}
                            {p.quantity > 1 && <p className="mt-1 text-xs text-white/60">× {p.quantity}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </Reveal>
          )}

          <Section id="about" title="About the tournament" icon={<Sparkles className="size-5" />}>
            <Prose text={t.description} />
          </Section>

          <Section id="categories" title="Competition categories" icon={<Users className="size-5" />}>
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Eligibility</th>
                    <th className="px-4 py-3">Fee</th>
                    <th className="px-4 py-3 text-right">Slots</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {t.categoryStats.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3">
                        <p className="font-bold">{c.name}</p>
                        <p className="text-xs text-subtle">{c.teamSize === 1 ? "Individual" : `Team of ${c.teamSize}`}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-muted sm:table-cell">
                        {GENDER_RULE_LABEL[c.genderRule]}
                        {(c.minAge || c.maxAge) && <span className="block text-xs">Age {c.minAge ?? "any"}–{c.maxAge ?? "any"}</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold">{c.fee === 0 ? "Free" : formatMoney(c.fee)}</td>
                      <td className="px-4 py-3 text-right">
                        {c.left == null ? <span className="text-muted">Open</span> : c.left === 0 ? <Badge tone="red">Full</Badge> : <span className={c.left <= 5 ? "font-bold text-accent-600" : "font-semibold"}>{c.left} / {c.maxEntries}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {t.venue && (
            <Section id="venue" title="Venue" icon={<MapPin className="size-5" />}>
              <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
                <div>
                  <p className="text-lg font-bold">{t.venue.name}</p>
                  <p className="mt-1 text-muted">
                    {t.venue.addressLine}
                    <br />
                    {t.venue.city}
                    {t.venue.state ? `, ${t.venue.state}` : ""} {t.venue.postalCode}
                  </p>
                  {maps && (
                    <a href={maps} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-brand hover:underline">
                      <Navigation className="size-4" /> Get directions
                    </a>
                  )}
                </div>
                {embed && <iframe title="Venue map" src={embed} className="h-56 w-full rounded-xl border border-line" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
              </div>
            </Section>
          )}

          {gallery.length > 0 && (
            <Section id="gallery" title="Venue & courts" icon={<Award className="size-5" />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((g) => (
                  <div key={g.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-canvas">
                    <Image src={g.url} alt={g.alt ?? ""} fill sizes="(min-width:640px) 33vw, 50vw" className="object-cover transition duration-500 hover:scale-105" />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {t.rules && (
            <Section id="rules" title="Rules & regulations" icon={<ScrollText className="size-5" />}>
              <Prose text={t.rules} />
            </Section>
          )}

          <Section id="instructions" title="Participant instructions" icon={<ShieldCheck className="size-5" />}>
            <div className="rounded-xl border-l-4 border-accent bg-accent-50 p-4 text-sm font-medium leading-relaxed">{t.participantInstructions || DEFAULT_INSTRUCTIONS}</div>
          </Section>

          {(t.terms || t.refundPolicy) && (
            <div className="grid gap-6 md:grid-cols-2">
              {t.terms && (
                <Section id="terms" title="Terms & conditions">
                  <Prose text={t.terms} small />
                </Section>
              )}
              {t.refundPolicy && (
                <Section id="refunds" title="Cancellation & refund policy">
                  <Prose text={t.refundPolicy} small />
                </Section>
              )}
            </div>
          )}

          {t.sponsors.length > 0 && (
            <Section title="Sponsors">
              <div className="flex flex-wrap gap-3">
                {t.sponsors.map((s) => (
                  <a key={s.id} href={s.website ?? undefined} target="_blank" rel="noopener noreferrer" className="flex h-16 min-w-36 items-center justify-center rounded-xl border border-line bg-white px-5 font-bold text-muted">
                    {s.logoUrl ? <Image src={s.logoUrl} alt={s.name} width={120} height={48} className="max-h-10 w-auto object-contain" /> : s.name}
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand to-brand-700 p-5 text-white">
              <p className="text-sm text-white/75">Entry fee from</p>
              <p className="display text-5xl">{minFee === 0 ? "Free" : formatMoney(minFee)}</p>
              {totalLeft != null && <p className="mt-1 text-sm font-semibold">{totalLeft === 0 ? "All slots filled" : `${totalLeft} slots remaining`}</p>}
            </div>
            <dl className="divide-y divide-line px-5 text-sm">
              <Row label="Tournament date" value={formatDate(t.startDate, { weekday: "short" })} />
              <Row label="Registration opens" value={formatDateTime(t.registrationOpensAt)} />
              <Row label="Registration closes" value={formatDateTime(t.registrationClosesAt)} />
              {t.matchStartTime && <Row label="First match" value={t.matchStartTime} />}
              <Row label="Max participants" value={t.maxParticipants ? String(t.maxParticipants) : "—"} />
            </dl>
            <div className="space-y-2.5 p-5 pt-2">
              {premium && (
                <p className="rounded-xl bg-premium-50 px-4 py-3 text-sm text-ink ring-1 ring-inset ring-premium/50">
                  <strong>Premium event.</strong> The prize pool is above ₹30,000, so registration is open to Premium members.
                </p>
              )}
              {t.window.open ? (
                premiumLocked ? (
                  <PremiumButton className="w-full">Get Premium to register</PremiumButton>
                ) : (
                  <ButtonLink href={`/tournaments/${t.slug}/register`} variant="accent" size="lg" className="w-full">
                    Register now
                  </ButtonLink>
                )
              ) : (
                <div className="rounded-xl bg-canvas px-4 py-3 text-center text-sm font-semibold text-muted">{t.window.reason}</div>
              )}
              {hasFixtures &&
                (canSeeFixtures ? (
                  <ButtonLink href={`/tournaments/${t.slug}/fixtures`} variant="secondary" className="w-full">
                    <Swords className="size-4" /> Fixtures & bracket
                  </ButtonLink>
                ) : (
                  <p className="flex items-center justify-center gap-1.5 text-center text-xs text-subtle">
                    <Lock className="size-3.5" /> Fixtures are visible to confirmed participants
                  </p>
                ))}
            </div>
          </Card>

          {t.organiser && (
            <Card className="mt-5 p-5">
              <p className="eyebrow text-subtle">Organised by</p>
              <div className="mt-3 flex items-center gap-3">
                {t.organiser.logoUrl ? <Image src={t.organiser.logoUrl} alt="" width={44} height={44} className="size-11 rounded-xl object-cover" /> : <div className="grid size-11 place-items-center rounded-xl bg-navy font-bold text-white">{t.organiser.name[0]}</div>}
                <p className="font-bold">{t.organiser.name}</p>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <a href={`tel:${t.organiser.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-muted hover:text-brand"><Phone className="size-4" />{t.organiser.phone}</a>
                <a href={`mailto:${t.organiser.email}`} className="flex items-center gap-2 text-muted hover:text-brand"><Mail className="size-4" />{t.organiser.email}</a>
              </div>
            </Card>
          )}
          <p className="mt-4 text-center text-xs text-subtle">
            Payments are processed securely by Razorpay. <Link href="/refund-policy" className="underline">Refund policy</Link>
          </p>
        </aside>
      </div>
      {/* Mobile: keep the primary action within thumb reach */}
      {t.window.open && <div className="h-20 lg:hidden" aria-hidden />}
      {t.window.open && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 shadow-[0_-8px_24px_-16px_rgb(7_18_46/0.4)] lg:hidden">
          <div>
            <p className="text-xs text-subtle">Entry from</p>
            <p className="text-lg font-extrabold leading-tight">{minFee === 0 ? "Free" : formatMoney(minFee)}</p>
          </div>
          {premiumLocked ? (
            <PremiumButton size="md">Get Premium</PremiumButton>
          ) : (
            <ButtonLink href={`/tournaments/${t.slug}/register`} variant="accent">Register now</ButtonLink>
          )}
        </div>
      )}
    </>
  );
}

function Section({ id, title, icon, children }: { id?: string; title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Reveal>
      <section id={id} className="card scroll-mt-24 p-6">
        <h2 className="mb-4 flex items-center gap-2.5 text-xl font-extrabold">
          {icon && <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand">{icon}</span>}
          {title}
        </h2>
        {children}
      </section>
    </Reveal>
  );
}

function Prose({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className={`space-y-3 whitespace-pre-line leading-relaxed text-muted ${small ? "text-sm" : ""}`}>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
