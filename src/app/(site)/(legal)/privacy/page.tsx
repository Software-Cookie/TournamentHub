import { PageHero } from "@/components/site/page-hero";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" compact>Last updated: November 2026</PageHero>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <p>We collect only what we need to run tournaments and keep your data secure, in line with India’s Digital Personal Data Protection Act, 2023.</p>
        <h2>What we collect</h2>
        <ul>
          <li>Account details: name, email, phone, city and a securely hashed password (or your Google sign-in).</li>
          <li>Registration details for you and your team-mates: names, contact details, date of birth, gender (where eligibility requires it), emergency contact and answers to organiser questions.</li>
          <li>Payment references from Razorpay (order and payment IDs, status, amount). We never receive card or bank credentials.</li>
          <li>Technical logs needed for security (IP address for rate limiting, audit logs of sensitive actions).</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>To confirm registrations, issue tickets, schedule matches and send transactional emails and reminders.</li>
          <li>To share participant details with the organiser of the tournament you entered — only for that tournament.</li>
          <li>To prevent fraud, duplicate entries and abuse.</li>
        </ul>
        <h2>Who can see your data</h2>
        <p>Your tickets and receipts are visible only to you (and team-mates listed on the same registration). Fixtures and match details are visible only to confirmed participants of that tournament and its organisers.</p>
        <h2>Retention & your rights</h2>
        <p>Registration and payment records are kept as required for accounting and dispute resolution. You can request access, correction or deletion of your personal data by contacting us; some records may be retained where the law requires.</p>
        <h2>Processors</h2>
        <p>We use Razorpay (payments), Resend (email), Cloudinary (images) and Vercel (hosting) to provide the service.</p>
      </article>
    </>
  );
}
