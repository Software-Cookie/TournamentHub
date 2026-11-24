import { PageHero } from "@/components/site/page-hero";

export const metadata = { title: "Terms & conditions" };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms & conditions" compact>Last updated: November 2026</PageHero>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <p>These terms govern your use of TournamentHub (the “Platform”) to discover, register for and take part in sports tournaments. By creating an account or registering for a tournament you agree to them.</p>
        <h2>1. Accounts</h2>
        <ul>
          <li>You must provide accurate information and keep your password secure.</li>
          <li>You are responsible for registrations made from your account, including details you enter for team-mates.</li>
          <li>We may suspend accounts that misuse the Platform or provide false information.</li>
        </ul>
        <h2>2. Tournament registrations</h2>
        <ul>
          <li>Each tournament is run by its listed organiser, whose rules, eligibility criteria and schedule apply in addition to these terms.</li>
          <li>A registration is confirmed only after the payment is verified by our servers (and, where applicable, approved by the organiser). A confirmed registration generates a digital ticket.</li>
          <li>Unpaid registrations hold a slot for a limited time and are released automatically afterwards.</li>
          <li>Organisers may decline or cancel entries that do not meet eligibility rules; any payment is then refunded per the refund policy.</li>
        </ul>
        <h2>3. Payments</h2>
        <p>Payments are processed by Razorpay. We never see or store your card or banking credentials. Fees shown at checkout are final and inclusive of all charges.</p>
        <h2>4. Participation & conduct</h2>
        <ul>
          <li>You confirm you are medically fit to participate and take part at your own risk.</li>
          <li>Report at the venue on time with your ticket and a valid ID. Late arrival may result in a walkover.</li>
          <li>Referees’ and organisers’ decisions on match play are final.</li>
        </ul>
        <h2>5. Media</h2>
        <p>Organisers may photograph or film tournaments and use the material to promote the event and the Platform.</p>
        <h2>6. Liability</h2>
        <p>To the extent permitted by law, the Platform is not liable for injuries, loss of belongings, or changes made by organisers to schedules, venues or prizes. Prize fulfilment is the organiser’s responsibility.</p>
        <h2>7. Changes</h2>
        <p>We may update these terms; material changes will be notified by email or on the Platform.</p>
      </article>
    </>
  );
}
