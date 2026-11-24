import { test } from "node:test";
import assert from "node:assert/strict";
import { extendPremium, hostingFee, isPremiumActive, isPremiumEvent, PREMIUM_PLANS } from "../src/lib/pricing";

test("hosting fee adds 2% platform charge and 18% GST", () => {
  const f = hostingFee(49900); // ₹499
  assert.equal(f.platformFee, 998);
  assert.equal(f.gst, Math.round((49900 + 998) * 0.18));
  assert.equal(f.total, f.base + f.platformFee + f.gst);
  assert.equal(f.total, 60060); // ₹600.60
});

test("free listing stays free", () => {
  assert.deepEqual(hostingFee(0), { base: 0, platformFee: 0, gst: 0, total: 0 });
});

test("premium event threshold is strictly more than ₹30,000", () => {
  assert.equal(isPremiumEvent(30_000_00), false);
  assert.equal(isPremiumEvent(30_000_01), true);
  assert.equal(isPremiumEvent(null), false);
});

test("premium plans: ₹59 a month, yearly 10% off", () => {
  assert.equal(PREMIUM_PLANS.MONTHLY.amount, 5900);
  assert.equal(PREMIUM_PLANS.YEARLY.amount, 63720);
});

test("buying premium extends an active membership and clamps month ends", () => {
  const now = new Date("2026-01-31T10:00:00Z");
  const fresh = extendPremium(null, 1, now);
  assert.equal(fresh.start.getTime(), now.getTime());
  assert.ok(fresh.end.getMonth() === 1, "31 Jan + 1 month lands in February");
  const active = new Date("2026-03-10T00:00:00Z");
  const ext = extendPremium(active, 12, now);
  assert.equal(ext.start.getTime(), active.getTime());
  assert.equal(ext.end.getFullYear(), 2027);
  assert.equal(isPremiumActive(ext.end, now), true);
  assert.equal(isPremiumActive(new Date("2025-01-01"), now), false);
});
