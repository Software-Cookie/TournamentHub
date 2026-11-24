import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { confirmPayment, markPaymentFailed, RegistrationError } from "@/server/registrations";
import { confirmListingPayment, markListingFailed } from "@/server/listings";
import { confirmMembershipPayment, markMembershipFailed } from "@/server/membership";
import { sha256 } from "@/lib/tokens";

export const dynamic = "force-dynamic";

type RzEvent = {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; status: string; error_description?: string } };
    order?: { entity: { id: string } };
    refund?: { entity: { id: string; payment_id: string; status: string } };
  };
};

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(raw) as RzEvent;
  const eventId = req.headers.get("x-razorpay-event-id") ?? `hash_${sha256(raw)}`;

  // Idempotency: record the event first; a duplicate delivery that was already processed is a no-op.
  try {
    await db.webhookEvent.create({ data: { id: eventId, provider: "razorpay", type: event.event, payload: event as unknown as Prisma.InputJsonValue } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await db.webhookEvent.findUnique({ where: { id: eventId } });
      if (existing?.processedAt) return NextResponse.json({ ok: true, duplicate: true });
    } else throw e;
  }

  try {
    const p = event.payload.payment?.entity;
    switch (event.event) {
      case "payment.captured":
      case "order.paid":
        if (p) {
          if (await db.payment.findUnique({ where: { providerOrderId: p.order_id }, select: { id: true } })) await confirmPayment({ orderId: p.order_id, paymentId: p.id, via: "webhook" });
          else if (await db.listingFee.findUnique({ where: { providerOrderId: p.order_id }, select: { id: true } })) await confirmListingPayment({ orderId: p.order_id, paymentId: p.id, via: "webhook" });
          else if (await db.premiumMembership.findUnique({ where: { providerOrderId: p.order_id }, select: { id: true } })) await confirmMembershipPayment({ orderId: p.order_id, paymentId: p.id, via: "webhook" });
        }
        break;
      case "payment.failed":
        if (p) {
          await markPaymentFailed(p.order_id, p.error_description ?? "Payment failed", p.id);
          await markListingFailed(p.order_id, p.error_description ?? "Payment failed");
          await markMembershipFailed(p.order_id, p.error_description ?? "Payment failed");
        }
        break;
      case "refund.processed":
      case "refund.failed": {
        const r = event.payload.refund?.entity;
        if (r) await db.refund.updateMany({ where: { providerRefundId: r.id }, data: { status: event.event === "refund.processed" ? "PROCESSED" : "FAILED", processedAt: new Date() } });
        break;
      }
      default:
        break;
    }
    await db.webhookEvent.update({ where: { id: eventId }, data: { processedAt: new Date(), error: null } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.webhookEvent.update({ where: { id: eventId }, data: { error: message.slice(0, 500) } }).catch(() => {});
    // Business-rule rejections (e.g. unknown order) shouldn't trigger endless retries; infrastructure errors should.
    const retry = !(e instanceof RegistrationError);
    return NextResponse.json({ ok: false, error: message }, { status: retry ? 500 : 200 });
  }
}
