/**
 * Pricing rules shared by server and client. All amounts are in paise.
 * Pure module: safe to import anywhere and covered by unit tests.
 */

/** Platform charge on the hosting (listing) fee. */
export const PLATFORM_CHARGE_RATE = 0.02;
/** GST, applied to the listing fee plus the platform charge. */
export const GST_RATE = 0.18;

export type HostingFeeBreakdown = { base: number; platformFee: number; gst: number; total: number };

/** Total an organiser pays to host one tournament of a sport whose listing fee is `base`. */
export function hostingFee(base: number): HostingFeeBreakdown {
  const b = Math.max(0, Math.round(base));
  const platformFee = Math.round(b * PLATFORM_CHARGE_RATE);
  const gst = Math.round((b + platformFee) * GST_RATE);
  return { base: b, platformFee, gst, total: b + platformFee + gst };
}

/** A tournament whose cash prize pool is more than ₹30,000 is a premium event. */
export const PREMIUM_PRIZE_THRESHOLD = 30_000_00;
export const isPremiumEvent = (prizePoolPaise: number | null | undefined) => (prizePoolPaise ?? 0) > PREMIUM_PRIZE_THRESHOLD;

export type PremiumPlanId = "MONTHLY" | "YEARLY";
export const PREMIUM_MONTHLY_PRICE = 59_00;
export const YEARLY_DISCOUNT = 0.1;

export const PREMIUM_PLANS: Record<PremiumPlanId, { id: PremiumPlanId; label: string; months: number; amount: number; fullPrice: number }> = {
  MONTHLY: { id: "MONTHLY", label: "1 month", months: 1, amount: PREMIUM_MONTHLY_PRICE, fullPrice: PREMIUM_MONTHLY_PRICE },
  YEARLY: {
    id: "YEARLY",
    label: "1 year",
    months: 12,
    amount: Math.round(PREMIUM_MONTHLY_PRICE * 12 * (1 - YEARLY_DISCOUNT)),
    fullPrice: PREMIUM_MONTHLY_PRICE * 12,
  },
};

/** New expiry after buying `months`: extends an active membership, otherwise starts now. */
export function extendPremium(currentUntil: Date | null | undefined, months: number, now = new Date()) {
  const start = currentUntil && currentUntil > now ? new Date(currentUntil) : new Date(now);
  const end = new Date(start);
  const day = end.getDate();
  end.setMonth(end.getMonth() + months);
  // Clamp month overflow (e.g. 31 Jan + 1 month -> 28/29 Feb, not 2/3 Mar).
  if (end.getDate() < day) end.setDate(0);
  return { start, end };
}

export const isPremiumActive = (until: Date | string | null | undefined, now = new Date()) => !!until && new Date(until) > now;
