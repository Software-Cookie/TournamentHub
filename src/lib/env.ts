import "server-only";
import { isDemoMode } from "@/lib/demo";

const isProd = process.env.NODE_ENV === "production";
const isDemo = isDemoMode();

export const env = {
  isProd,
  isDemo,
  appUrl: (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    get configured() {
      return Boolean(this.keyId && this.keySecret);
    },
  },
  // Simulated checkout: local development (opt-in) or an explicit demo deployment. Real Razorpay keys always take precedence.
  paymentsSimulator: (!isProd && process.env.PAYMENTS_DEV_SIMULATOR === "true") || isDemo,
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "TournamentHub <onboarding@resend.dev>",
  },
  /** Without an email provider: print emails to the server log (dev/demo) instead of failing. */
  emailConsoleFallback: !isProd || isDemo,
  /** Without an email provider in dev/demo, activate new accounts immediately (links can't be delivered). */
  get autoVerifySignups() {
    return this.emailConsoleFallback && !this.resend.apiKey;
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    get configured() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    },
  },
  /** Local-disk uploads are only acceptable in development or a demo. */
  localUploads: !isProd || isDemo,
  cronSecret: process.env.CRON_SECRET || "",
  googleAuth: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
};
