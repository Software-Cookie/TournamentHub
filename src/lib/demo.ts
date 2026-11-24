/**
 * DEMO_MODE=true lets a production build be shown to people without real payment/email providers:
 *  - payments use the simulator ONLY while Razorpay keys are absent (real keys always win),
 *  - sign-ups are auto-verified ONLY while no email provider is configured,
 *  - a site-wide "Demo site" ribbon is shown.
 * Never set DEMO_MODE on the real production deployment.
 */
export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}
