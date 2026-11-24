import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertUser, canManageTournament } from "@/lib/authz";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { confirmPayment } from "@/server/registrations";
import { confirmListingPayment } from "@/server/listings";
import { confirmMembershipPayment } from "@/server/membership";

const schema = z.object({
  razorpay_order_id: z.string().min(1).max(80),
  razorpay_payment_id: z.string().min(1).max(80),
  razorpay_signature: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await assertUser();
    if (!(await rateLimit(`pay-verify:${user.id}`, 20, 300))) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
    const body = schema.parse(await req.json());

    const payment = await db.payment.findUnique({ where: { providerOrderId: body.razorpay_order_id }, select: { userId: true } });
    if (payment) {
      if (payment.userId !== user.id) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      const result = await confirmPayment({ orderId: body.razorpay_order_id, paymentId: body.razorpay_payment_id, signature: body.razorpay_signature, via: "checkout" });
      const reg = await db.registration.findUnique({ where: { id: result.registrationId }, select: { id: true, status: true, code: true } });
      return NextResponse.json({ kind: "registration", registrationId: reg?.id, status: reg?.status, code: reg?.code, refunded: "needsRefund" in result && result.needsRefund });
    }

    const listing = await db.listingFee.findUnique({ where: { providerOrderId: body.razorpay_order_id }, select: { tournamentId: true } });
    if (listing && (await canManageTournament(user, listing.tournamentId))) {
      const r = await confirmListingPayment({ orderId: body.razorpay_order_id, paymentId: body.razorpay_payment_id, signature: body.razorpay_signature, via: "checkout" });
      return NextResponse.json({ kind: "listing", tournamentId: r.tournamentId, status: "PAID" });
    }
    const membership = await db.premiumMembership.findUnique({ where: { providerOrderId: body.razorpay_order_id }, select: { userId: true } });
    if (membership && membership.userId === user.id) {
      await confirmMembershipPayment({ orderId: body.razorpay_order_id, paymentId: body.razorpay_payment_id, signature: body.razorpay_signature, via: "checkout" });
      return NextResponse.json({ kind: "premium", status: "PAID" });
    }
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  } catch (e) {
    return jsonError(e);
  }
}
