import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarX, Crown } from "lucide-react";
import { isPremiumEvent } from "@/lib/pricing";
import { isPremiumUser } from "@/server/membership";
import { PremiumButton } from "@/components/premium/premium-modal";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { getTournamentBySlug } from "@/server/queries/tournaments";
import { paymentMode } from "@/lib/payments/razorpay";
import { parseCustomQuestions } from "@/lib/validation";
import { GENDER_RULE_LABEL } from "@/lib/sports";
import { PageHero } from "@/components/site/page-hero";
import { RegistrationForm } from "@/components/registration/registration-form";
import { ButtonLink, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Register", robots: { index: false } };

export default async function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/tournaments/${slug}/register`);
  const t = await getTournamentBySlug(slug);
  if (!t || t.status === "DRAFT" || t.status === "ARCHIVED") notFound();

  const [dbUser, existing] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true, city: true } }),
    db.registration.findMany({ where: { tournamentId: t.id, userId: user.id, activeKey: { not: null } }, select: { id: true, categoryId: true } }),
  ]);
  const existingBy = new Map(existing.map((e) => [e.categoryId, e.id]));
  const premiumLocked = isPremiumEvent(t.prizePoolValue) && !(await isPremiumUser(user.id));

  return (
    <>
      <PageHero eyebrow={`${t.sport.name} · ${formatDate(t.startDate)}`} title={t.name} compact>
        <Link href={`/tournaments/${t.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white">
          <ArrowLeft className="size-4" /> Tournament details
        </Link>
      </PageHero>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {!t.window.open ? (
          <EmptyState icon={<CalendarX className="size-6" />} title="Registration isn't open" action={<ButtonLink href={`/tournaments/${t.slug}`}>Back to tournament</ButtonLink>}>
            {t.window.reason}.
          </EmptyState>
        ) : premiumLocked ? (
          <EmptyState icon={<Crown className="size-6" />} title="This is a premium event" action={<PremiumButton>Get Premium</PremiumButton>}>
            Tournaments with a prize pool above ₹30,000 are open to Premium members. Premium costs ₹59 a month, or save 10% with a yearly plan.
          </EmptyState>
        ) : (
          <RegistrationForm
            tournament={{ id: t.id, name: t.name, slug: t.slug, terms: t.terms, refundPolicy: t.refundPolicy }}
            requiresApproval={t.requiresApproval}
            paymentAvailable={paymentMode() !== "unavailable"}
            questions={parseCustomQuestions(t.customQuestions)}
            prefill={{ name: dbUser?.name ?? "", email: dbUser?.email ?? "", phone: dbUser?.phone ?? "", city: dbUser?.city ?? "" }}
            categories={t.categoryStats
              .filter((c) => c.status === "OPEN")
              .map((c) => ({
                id: c.id,
                name: c.name,
                teamSize: c.teamSize,
                minTeamSize: c.minTeamSize,
                participantType: c.participantType,
                genderRule: c.genderRule,
                fee: c.fee,
                left: c.left,
                minAge: c.minAge,
                maxAge: c.maxAge,
                existingRegistrationId: existingBy.get(c.id) ?? null,
                eligibility: `${c.teamSize > 2 ? `Squad of ${c.minTeamSize && c.minTeamSize < c.teamSize ? `${c.minTeamSize}–${c.teamSize}` : c.teamSize}, ` : ""}${GENDER_RULE_LABEL[c.genderRule]}${c.minAge || c.maxAge ? ` · Age ${c.minAge ?? "any"}–${c.maxAge ?? "any"}` : ""}`,
              }))}
          />
        )}
      </div>
    </>
  );
}
