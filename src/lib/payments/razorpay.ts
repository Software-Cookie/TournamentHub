import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "@/lib/env";
import { randomToken, safeEqual } from "@/lib/tokens";

let client: Razorpay | null = null;
function rz() {
  if (!env.razorpay.configured) throw new Error("Razorpay is not configured");
  client ??= new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  return client;
}

export type PaymentMode = "razorpay" | "simulator" | "unavailable";
export function paymentMode(): PaymentMode {
  if (env.razorpay.configured) return "razorpay";
  if (env.paymentsSimulator) return "simulator";
  return "unavailable";
}

export async function createOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>) {
  if (paymentMode() === "simulator") return { id: `sim_order_${randomToken(10)}`, amount, currency };
  const order = await rz().orders.create({ amount, currency, receipt: receipt.slice(0, 40), notes, payment_capture: true } as never);
  return { id: order.id as string, amount: Number(order.amount), currency: order.currency as string };
}

/** Checkout signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  if (paymentMode() === "simulator") return orderId.startsWith("sim_order_") && paymentId.startsWith("sim_pay_") && signature === "simulated";
  const expected = crypto.createHmac("sha256", env.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!env.razorpay.webhookSecret || !signature) return false;
  const expected = crypto.createHmac("sha256", env.razorpay.webhookSecret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

export type GatewayPayment = { id: string; orderId: string; status: string; amount: number; currency: string; method?: string; fee?: number; tax?: number; errorDescription?: string };

/** Fetch the authoritative payment record from Razorpay (and capture it if only authorised). */
export async function fetchAndCapturePayment(paymentId: string, expectedAmount: number, currency: string): Promise<GatewayPayment> {
  if (paymentMode() === "simulator") {
    return { id: paymentId, orderId: "", status: "captured", amount: expectedAmount, currency, method: "simulator", fee: Math.round(expectedAmount * 0.0236), tax: Math.round(expectedAmount * 0.0036) };
  }
  let p = await rz().payments.fetch(paymentId);
  if (p.status === "authorized") {
    p = await rz().payments.capture(paymentId, expectedAmount, currency);
  }
  return {
    id: p.id,
    orderId: p.order_id,
    status: p.status,
    amount: Number(p.amount),
    currency: p.currency,
    method: p.method,
    fee: p.fee != null ? Number(p.fee) : undefined,
    tax: p.tax != null ? Number(p.tax) : undefined,
    errorDescription: p.error_description ?? undefined,
  };
}

export async function createRefund(paymentId: string, amount: number, notes: Record<string, string>) {
  if (paymentMode() === "simulator" || paymentId.startsWith("sim_pay_")) {
    return { id: `sim_rfnd_${randomToken(8)}`, status: "processed" as const };
  }
  const r = await rz().payments.refund(paymentId, { amount, notes });
  return { id: r.id as string, status: r.status as "pending" | "processed" | "failed" };
}

/** Captured/authorised payments for an order — used by the reconciliation job. */
export async function fetchOrderPayments(orderId: string) {
  if (paymentMode() !== "razorpay" || orderId.startsWith("sim_")) return [];
  const res = (await rz().orders.fetchPayments(orderId)) as unknown as { items: { id: string; status: string; error_description?: string }[] };
  return res.items ?? [];
}

export function publicKeyId() {
  return paymentMode() === "razorpay" ? env.razorpay.keyId : null;
}
