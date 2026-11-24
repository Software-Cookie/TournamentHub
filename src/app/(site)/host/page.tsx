import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { getCurrentUser, getMemberOrgIds, isAdminRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { sportsOverview } from "@/server/queries/tournaments";
import { PageHero } from "@/components/site/page-hero";
import { SportIcon } from "@/components/sport-icon";
import { OrganiserForm } from "@/components/organiser/organiser-form";
import { ButtonLink, Card } from "@/components/ui";
import { HostSignIn } from "@/components/organiser/host-sign-in";

export const metadata: Metadata = { title: "Host a tournament", description: "List your badminton, cricket, football, tennis or other tournament on TournamentHub. No subscription." };
export const dynamic = "force-dynamic";

export default async function HostPage() {
  const [user, sports] = await Promise.all([getCurrentUser(), sportsOverview()]);
  const isManager = user ? isAdminRole(user.role) || (await getMemberOrgIds(user.id)).length > 0 : false;
  const profile = user ? await db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true, city: true } }) : null;

  return (
    <>
      <PageHero eyebrow="For organisers" title="Host your tournament">
        Publish any sport in minutes. Players register and pay online, you run the draw and the courts from your phone, and we settle the entry fees to you.
      </PageHero>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8">
        <div className="space-y-8">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="text-lg font-extrabold">Sports you can host</h2>
              <span className="text-xs text-subtle">Any format: singles, doubles, teams</span>
            </div>
            <ul className="divide-y divide-line">
              {sports.map((s) => (
                <li key={s.slug} className="flex items-center gap-4 px-6 py-3.5">
                  <span className="grid size-10 place-items-center rounded-xl bg-navy text-white">
                    <SportIcon sport={s.slug} />
                  </span>
                  <span className="flex-1 font-semibold">{s.name}</span>
                </li>
              ))}
            </ul>
          </Card>

          <div>
            <h2 className="mb-4 text-lg font-extrabold">What you get</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                "Your tournament page with prizes, venue map and rules",
                "Online registration for singles, doubles and full squads",
                "Razorpay payments with automatic tickets & receipts",
                "Seeded or random brackets with BYEs handled for you",
                "Live match control centre for multiple courts",
                "QR ticket check-in from any phone",
                "Email announcements and automatic reminders",
                "Registration & revenue exports (CSV / Excel)",
              ].map((f) => (
                <li key={f} className="flex gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" /> {f}
                </li>
              ))}
            </ul>
          </div>

          <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
            {[
              ["Create your profile", "Tell players who's organising."],
              ["Set up the tournament", "Sport, categories, fees, venue and prizes."],
              ["Pay the hosting fee & publish", "You see the full fee before you pay."],
            ].map(([t, d], i) => (
              <li key={t} className="bg-white p-5">
                <span className="display text-4xl italic text-brand/20">{i + 1}</span>
                <p className="mt-1 font-bold">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-6">
            {!user ? (
              <>
                <h2 className="text-xl font-extrabold">Start hosting</h2>
                <p className="mb-5 mt-1 text-sm text-muted">Create a free account first — it takes a minute.</p>
                <HostSignIn />
              </>
            ) : isManager ? (
              <>
                <h2 className="text-xl font-extrabold">You&apos;re set up as an organiser</h2>
                <p className="mb-5 mt-1 text-sm text-muted">Create a tournament or manage your existing ones.</p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href="/manage/tournaments/new" variant="accent">Create a tournament <ArrowRight className="size-4" /></ButtonLink>
                  <ButtonLink href="/manage" variant="secondary">Organiser console</ButtonLink>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-extrabold">Create your organiser profile</h2>
                <p className="mb-5 mt-1 text-sm text-muted">This appears on your tournament pages and tickets.</p>
                <OrganiserForm mode="create" values={{ name: "", contactEmail: profile?.email ?? "", contactPhone: profile?.phone ?? "", city: profile?.city ?? "" }} />
              </>
            )}
          </Card>
          <p className="mt-3 text-center text-xs text-subtle">You&apos;ll see the full hosting fee (listing fee, 2% platform charge and 18% GST) while you set up your tournament. It is non-refundable once the tournament is published. Entry fees are settled to your UPI/bank after deducting refunds and gateway charges.</p>
        </aside>
      </div>
    </>
  );
}
