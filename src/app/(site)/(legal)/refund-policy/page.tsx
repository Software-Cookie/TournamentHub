import { PageHero } from "@/components/site/page-hero";

export const metadata = { title: "Refund policy" };

export default function RefundPolicyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Cancellation & refund policy" compact>Last updated: November 2026</PageHero>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <p>Each tournament publishes its own cancellation and refund terms on its page — those take precedence. Where a tournament does not specify otherwise, the following applies.</p>
        <h2>Player withdrawals</h2>
        <ul>
          <li>7 or more days before the tournament: full refund.</li>
          <li>3–6 days before: 50% refund.</li>
          <li>Less than 3 days before, or no-show: no refund.</li>
        </ul>
        <h2>Automatic full refunds</h2>
        <ul>
          <li>Your entry is declined by the organiser (manual approval tournaments).</li>
          <li>You were charged twice, or paid after your slot hold expired and the category had filled.</li>
          <li>The organiser cancels the tournament or your category.</li>
        </ul>
        <h2>How refunds are paid</h2>
        <p>Refunds are issued through Razorpay to the original payment method. They typically reflect within 5–7 working days, depending on your bank. You’ll receive an email when a refund is initiated, and it appears on your registration receipt.</p>
        <h2>Failed payments</h2>
        <p>If money was debited but the payment failed, your bank reverses it automatically, usually within 5–7 working days. If a payment succeeds after a delay, we confirm your entry automatically or refund it if the slot is gone.</p>
      </article>
    </>
  );
}
