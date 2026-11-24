import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BellRing, CreditCard, Eye, Radio, ShieldCheck, Sparkles, Ticket, Trophy } from "lucide-react";
import { Hero, type HeroClip } from "@/components/site/hero";
import { Counter, Reveal } from "@/components/motion";
import { TournamentCard } from "@/components/tournament-card";
import { CourtArt } from "@/components/court-art";
import { SportIcon } from "@/components/sport-icon";
import { ButtonLink, EmptyState } from "@/components/ui";
import { completedHighlights, featuredTournaments, platformStats, sportsOverview } from "@/server/queries/tournaments";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CLIPS: Omit<HeroClip, "src" | "poster">[] = [
  { sport: "badminton", label: "Badminton" },
  { sport: "football", label: "Football" },
  { sport: "cricket", label: "Cricket" },
  { sport: "tennis", label: "Tennis" },
  { sport: "basketball", label: "Basketball" },
  { sport: "volleyball", label: "Volleyball" },
];

function heroClips(): HeroClip[] {
  const dir = path.join(process.cwd(), "public", "media", "sports");
  return CLIPS.filter((c) => fs.existsSync(path.join(dir, `${c.sport}.mp4`))).map((c) => ({ ...c, src: `/media/sports/${c.sport}.mp4`, poster: `/media/sports/${c.sport}.jpg` }));
}

export default async function HomePage() {
  const [featured, highlights, stats, sports] = await Promise.all([featuredTournaments(6), completedHighlights(3), platformStats(), sportsOverview()]);
  const clips = heroClips();

  return (
    <>
      <Hero clips={clips} />

      {/* Scoreboard strip */}
      <section className="border-y border-white/10 bg-navy-900 text-white" aria-label="Platform numbers">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-white/10 px-4 sm:px-6 md:grid-cols-4 md:divide-x lg:px-8">
          {[
            { v: stats.tournaments, l: "tournaments hosted" },
            { v: stats.players, l: "players competed" },
            { v: stats.matches, l: "matches played" },
            { v: sports.length, l: "sports supported" },
          ].map(({ v, l }) => (
            <div key={l} className="px-4 py-7 text-center md:py-9">
              <dt className="sr-only">{l}</dt>
              <dd>
                <Counter value={v} className="display block text-5xl text-white" />
                <span className="mt-1 block text-sm text-white/60">{l}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Browse by sport */}
      <section id="sports" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
        <Reveal className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <h2 className="display text-4xl italic text-navy sm:text-5xl">Pick your sport</h2>
          <p className="max-w-md text-muted">Badminton to cricket, chess to kabaddi — every tournament runs on the same brackets, tickets and live results.</p>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {sports.filter((s) => s.slug !== "other").map((s, i) => (
            <Reveal key={s.slug} delay={(i % 6) * 0.04}>
              <Link href={`/tournaments?sport=${s.slug}`} className="group flex h-full flex-col justify-between rounded-2xl border border-line bg-white p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card">
                <span className="grid size-11 place-items-center rounded-xl bg-navy text-white transition-colors group-hover:bg-brand">
                  <SportIcon sport={s.slug} className="size-6" />
                </span>
                <span className="mt-5 block font-extrabold">{s.name}</span>
                <span className="text-sm text-subtle">{s.live ? `${s.live} open now` : "Coming up"}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Featured tournaments */}
      <section id="featured" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="display text-4xl italic text-navy sm:text-5xl">Featured tournaments</h2>
              <p className="mt-2 max-w-xl text-muted">Open registrations, live slot counts. Lock your place before the draw is made.</p>
            </div>
            <ButtonLink href="/tournaments" variant="secondary" className="group">
              Browse all <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </ButtonLink>
          </Reveal>
          {featured.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((t, i) => (
                <Reveal key={t.id} delay={(i % 3) * 0.06}>
                  <TournamentCard t={t} priority={i < 3} />
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Trophy className="size-6" />} title="New tournaments are on the way">
              Create a free account to hear first when entries open.
            </EmptyState>
          )}
        </div>
      </section>

      {/* Culture */}
      <section className="relative overflow-hidden bg-navy py-24 text-white">
        <div className="court-pattern absolute inset-0" aria-hidden />
        <div className="glow-brand absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
          <Reveal>
            <h2 className="display text-5xl italic sm:text-6xl">
              More than a game.
              <br />
              <span className="text-brand-400">It&apos;s a culture.</span>
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">
              Every rally, over and set builds something bigger than a scoreline. Sport brings strangers onto the same court, turns early-morning practice into discipline, and turns opponents into lifelong friends.
            </p>
            <dl className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {[
                ["Community", "Meet players who share your obsession — across clubs, offices and cities."],
                ["Discipline", "A date on the calendar sharpens every training session."],
                ["Friendship", "Doubles partners, teammates, rivals — the people you meet stay."],
                ["Competitive spirit", "Test yourself under pressure and earn every point."],
              ].map(([t, d]) => (
                <div key={t} className="border-l-2 border-accent pl-4">
                  <dt className="font-bold">{t}</dt>
                  <dd className="mt-1 text-sm text-white/65">{d}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="grid grid-cols-6 grid-rows-[repeat(6,minmax(0,1fr))] gap-3" style={{ aspectRatio: "1.05" }}>
              {[
                ["badminton", "col-span-4 row-span-3"],
                ["cricket", "col-span-2 row-span-3"],
                ["basketball", "col-span-2 row-span-3"],
                ["football", "col-span-4 row-span-3"],
              ].map(([s, cls]) => (
                <div key={s} className={`relative overflow-hidden rounded-2xl bg-navy-800 ${cls}`}>
                  <Image src={`/media/sports/${s}.jpg`} alt={`${s} players in action`} fill sizes="(min-width:1024px) 30vw, 60vw" className="object-cover" />
                  <span className="slant absolute bottom-3 left-3 rounded-md bg-navy/85 px-2.5 py-1 text-xs font-bold capitalize">
                    <span>{s}</span>
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works — a genuine sequence */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <h2 className="display text-4xl italic text-navy sm:text-5xl">From sign-up to centre court</h2>
          <p className="mt-2 text-muted">Four steps, about two minutes on your phone.</p>
        </Reveal>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line md:grid-cols-4">
          {[
            { t: "Discover a tournament", d: "Filter by sport, city, date, format and fee." },
            { t: "Register solo or as a team", d: "Singles, doubles or a full squad — one form." },
            { t: "Pay securely", d: "UPI, cards and netbanking via Razorpay, verified on our servers." },
            { t: "Get your ticket & compete", d: "QR ticket by email; fixtures and results in your dashboard." },
          ].map((s, i) => (
            <li key={s.t} className="bg-white p-7">
              <span className="display text-6xl italic text-brand/15">{i + 1}</span>
              <h3 className="mt-3 text-lg font-extrabold">{s.t}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why us */}
      <section className="bg-white py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.4fr] lg:px-8">
          <Reveal>
            <h2 className="display text-4xl italic text-navy sm:text-5xl">Built for players. Trusted by organisers.</h2>
            <p className="mt-4 max-w-md text-muted">Everything between &ldquo;I&apos;m in&rdquo; and the final whistle, handled properly.</p>
          </Reveal>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {[
              { icon: Sparkles, t: "Easy registration", d: "Forms adapt to singles, doubles and full squads." },
              { icon: ShieldCheck, t: "Secure payments", d: "Every payment is verified server-side with Razorpay." },
              { icon: Ticket, t: "Digital tickets", d: "QR ticket in your inbox; check in within seconds." },
              { icon: Eye, t: "Transparent draws", d: "Seeded brackets and a permanent record of every result." },
              { icon: Radio, t: "Live match updates", d: "Your court, opponent and start time, as it changes." },
              { icon: BellRing, t: "Automatic reminders", d: "Confirmations, schedule changes and reminders — never twice." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand">
                  <Icon className="size-5" />
                </span>
                <div>
                  <dt className="font-extrabold">{t}</dt>
                  <dd className="mt-1 text-sm text-muted">{d}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Host a tournament — the organiser offer */}
      <section id="host" className="relative overflow-hidden bg-navy py-24 text-white">
        <div className="glow-accent absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
          <Reveal>
            <h2 className="display text-5xl italic sm:text-6xl">
              Run your own
              <br />
              <span className="text-accent">tournament.</span>
            </h2>
            <p className="mt-5 max-w-lg text-lg text-white/75">
              Registrations, payments, tickets, brackets, live match control and announcements — in one console. Any sport, any format, no subscription.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-white/80">
              <li className="flex gap-2"><CreditCard className="mt-0.5 size-4 shrink-0 text-accent" /> Entry fees collected online and settled to you</li>
              <li className="flex gap-2"><Trophy className="mt-0.5 size-4 shrink-0 text-accent" /> Automatic fixtures with BYEs, seeding and results</li>
              <li className="flex gap-2"><Ticket className="mt-0.5 size-4 shrink-0 text-accent" /> QR check-in from any phone at the venue</li>
            </ul>
            <ButtonLink href="/host" variant="accent" size="lg" slant className="mt-9 h-14 px-8">
              Start hosting <ArrowRight className="size-5" />
            </ButtonLink>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-navy-800">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-sm text-white/60">
                <span>Sports you can host</span>
                <span>{sports.length} and counting</span>
              </div>
              <ul className="divide-y divide-white/10">
                {sports.map((s) => (
                  <li key={s.slug} className="flex items-center gap-4 px-5 py-3">
                    <SportIcon sport={s.slug} className="size-5 text-brand-400" />
                    <span className="flex-1 font-semibold">{s.name}</span>
                    <span className="text-sm text-white/55">{s.live ? `${s.live} live` : "Open for hosts"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Champions */}
      <section id="highlights" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
        <Reveal className="mb-10">
          <h2 className="display text-4xl italic text-navy sm:text-5xl">Hall of champions</h2>
          <p className="mt-2 text-muted">Recent winners from completed tournaments.</p>
        </Reveal>
        {highlights.length ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {highlights.map((h, i) => (
              <Reveal key={h.slug} delay={i * 0.06}>
                <Link href={`/tournaments/${h.slug}#results`} className="group block overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lift">
                  <div className="relative aspect-[16/9] bg-navy">
                    {h.bannerUrl ? <Image src={h.bannerUrl} alt="" fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover" /> : <CourtArt seed={h.slug} />}
                    <div className="absolute inset-0 bg-gradient-to-t from-navy/90 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <p className="text-xs font-semibold text-white/70">
                        {formatDate(h.date)}, {h.city} — {h.entries} entries
                      </p>
                      <h3 className="mt-0.5 text-lg font-extrabold">{h.name}</h3>
                    </div>
                  </div>
                  <ul className="divide-y divide-line p-2">
                    {h.winners.length ? (
                      h.winners.map((w) => (
                        <li key={w.category} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                          <span className="text-muted">{w.category}</span>
                          <span className="flex items-center gap-1.5 truncate font-bold">
                            <Trophy className="size-4 shrink-0 text-accent" /> {w.winner}
                          </span>
                        </li>
                      ))
                    ) : (
                      <li className="px-3 py-2.5 text-sm text-muted">Results being finalised</li>
                    )}
                  </ul>
                </Link>
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Trophy className="size-6" />} title="The first champions are yet to be crowned">
            Completed tournaments and their winners will appear here.
          </EmptyState>
        )}
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-navy px-6 py-16 text-white sm:px-12 sm:py-20">
          <Image src="/media/sports/volleyball.jpg" alt="" fill sizes="100vw" className="object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/40" aria-hidden />
          <div className="relative max-w-2xl">
            <h2 className="display text-5xl italic sm:text-7xl">
              Your next championship <span className="text-accent">starts here.</span>
            </h2>
            <p className="mt-5 max-w-lg text-white/75">Entries are limited and draws are made when registration closes. Don&apos;t watch from the stands.</p>
            <ButtonLink href="/tournaments" variant="accent" size="lg" slant className="mt-9 h-14 px-9 text-base">
              Explore Tournaments <ArrowRight className="size-5" />
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  );
}
