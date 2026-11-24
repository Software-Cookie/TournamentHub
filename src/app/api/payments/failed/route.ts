import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertUser, canManageTournament } from "@/lib/authz";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { markPaymentFailed } from "@/server/registrations";
import { markListingFailed } from "@/server/listings";
import { markMembershipFailed } from "@/server/membership";

const schema = z.object({ orderId: z.string().min(1).max(80), paymentId: z.string().max(80).optional(), reason: z.string().max(300).optional() });

/** Client-reported failure. Only ever moves an order to FAILED (never to PAID), so it can't be abused for gain. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await assertUser();
    if (!(await rateLimit(`pay-failed:${user.id}`, 20, 300))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    const body = schema.parse(await req.json());
    const payment = await db.payment.findUnique({ where: { providerOrderId: body.orderId }, select: { userId: true } });
    if (payment) {
      if (payment.userId !== user.id) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      await markPaymentFailed(body.orderId, body.reason || "Payment failed", body.paymentId);
      return NextResponse.json({ ok: true });
    }
    const listing = await db.listingFee.findUnique({ where: { providerOrderId: body.orderId }, select: { tournamentId: true } });
    if (listing && (await canManageTournament(user, listing.tournamentId))) {
      await markListingFailed(body.orderId, body.reason || "Payment failed");
      return NextResponse.json({ ok: true });
    }
    const membership = await db.premiumMembership.findUnique({ where: { providerOrderId: body.orderId }, select: { userId: true } });
    if (membership && membership.userId === user.id) {
      await markMembershipFailed(body.orderId, body.reason || "Payment failed");
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  } catch (e) {
    return jsonError(e);
  }
}
