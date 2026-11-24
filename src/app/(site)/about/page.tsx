import { Heart, ShieldCheck, Trophy, Users } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { ButtonLink, Card } from "@/components/ui";
import { Reveal } from "@/components/motion";

export const metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About us" title="Built for the love of the game">
        TournamentHub helps organisers run fair, well-managed tournaments — and helps players spend less time on paperwork and more time on court.
      </PageHero>
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-5 md:grid-cols-2">
          {[
            { icon: Trophy, t: "For players", d: "Find tournaments, register solo or with a partner, pay securely and carry your ticket, fixtures and results in your pocket." },
            { icon: Users, t: "For organisers", d: "Registrations, payments, seeded draws, live match control, check-in and announcements — in one console." },
            { icon: ShieldCheck, t: "Trust by design", d: "Every payment is verified server-side, every result change is logged, and participant data stays private." },
            { icon: Heart, t: "Starting with badminton", d: "Badminton is our first fully supported sport, with tennis, table tennis, chess, cricket, football and more on the way." },
          ].map(({ icon: Icon, t, d }, i) => (
            <Reveal key={t} delay={i * 0.06}>
              <Card className="h-full p-6">
                <Icon className="size-7 text-accent" />
                <h2 className="mt-3 text-lg font-extrabold">{t}</h2>
                <p className="mt-1 text-muted">{d}</p>
              </Card>
            </Reveal>
          ))}
        </div>
        <div className="mt-12 text-center">
          <ButtonLink href="/tournaments" variant="accent" size="lg">Explore tournaments</ButtonLink>
        </div>
      </div>
    </>
  );
}
