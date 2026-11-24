import { Crown } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { ProfileForms } from "@/components/dashboard/profile-forms";
import { PremiumBadge } from "@/components/premium/premium-badge";
import { PremiumButton } from "@/components/premium/premium-modal";
import { isPremiumActive, PREMIUM_PLANS } from "@/lib/pricing";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/dashboard/profile");
  const u = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      city: true,
      passwordHash: true,
      premiumUntil: true,
      accounts: { select: { provider: true } },
      premiumMemberships: { where: { status: "PAID" }, orderBy: { paidAt: "desc" }, take: 5, select: { id: true, plan: true, amount: true, paidAt: true, endsAt: true } },
    },
  });
  const premium = isPremiumActive(u.premiumUntil);

  return (
    <>
      <PageHeader eyebrow="Account" title="Profile" description="These details pre-fill your tournament registrations." />

      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className={premium ? "grid size-12 shrink-0 place-items-center rounded-xl bg-premium text-navy" : "grid size-12 shrink-0 place-items-center rounded-xl bg-canvas text-subtle"}>
              <Crown className="size-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold">{u.name || "Your account"}</h2>
                {premium ? <PremiumBadge label="Premium member" /> : <span className="text-sm font-semibold text-subtle">Free plan</span>}
              </div>
              <p className="mt-1 text-sm text-muted">
                {premium
                  ? `Premium is active until ${formatDate(u.premiumUntil)}. You can register for premium events.`
                  : `Premium events have prize pools above ₹30,000. Get Premium for ${formatMoney(PREMIUM_PLANS.MONTHLY.amount)} a month, or ${formatMoney(PREMIUM_PLANS.YEARLY.amount)} a year (10% off).`}
              </p>
            </div>
          </div>
          <PremiumButton variant={premium ? "secondary" : "accent"} size="md" className="shrink-0">
            {premium ? "Extend Premium" : "Get Premium"}
          </PremiumButton>
        </div>
        {u.premiumMemberships.length > 0 && (
          <table className="w-full border-t border-line text-sm">
            <caption className="sr-only">Premium payments</caption>
            <thead className="bg-canvas text-left text-xs text-subtle">
              <tr>
                <th className="px-6 py-2 font-semibold">Paid on</th>
                <th className="px-6 py-2 font-semibold">Plan</th>
                <th className="px-6 py-2 font-semibold">Valid until</th>
                <th className="px-6 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {u.premiumMemberships.map((m) => (
                <tr key={m.id}>
                  <td className="px-6 py-2.5">{formatDate(m.paidAt)}</td>
                  <td className="px-6 py-2.5">{PREMIUM_PLANS[m.plan].label}</td>
                  <td className="px-6 py-2.5">{formatDate(m.endsAt)}</td>
                  <td className="px-6 py-2.5 text-right font-semibold tabular-nums">{formatMoney(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <ProfileForms user={{ name: u.name ?? "", email: u.email, phone: u.phone ?? "", city: u.city ?? "" }} hasPassword={!!u.passwordHash} providers={u.accounts.map((a) => a.provider)} />
    </>
  );
}
