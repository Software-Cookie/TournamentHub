import { Mail, MapPin, Phone } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Card } from "@/components/ui";

export const metadata = { title: "Contact" };

const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@tournamenthub.in";
const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE || "+91 90000 00000";

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to us">
        Questions about a registration, a payment or hosting your own tournament? We usually reply within one working day.
      </PageHero>
      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-16 md:grid-cols-3">
        <Card className="p-6">
          <Mail className="size-6 text-brand" />
          <h2 className="mt-3 font-extrabold">Email</h2>
          <a href={`mailto:${email}`} className="mt-1 block text-muted hover:text-brand">{email}</a>
        </Card>
        <Card className="p-6">
          <Phone className="size-6 text-brand" />
          <h2 className="mt-3 font-extrabold">Phone</h2>
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="mt-1 block text-muted hover:text-brand">{phone}</a>
          <p className="text-xs text-subtle">Mon–Sat, 10am–7pm IST</p>
        </Card>
        <Card className="p-6">
          <MapPin className="size-6 text-brand" />
          <h2 className="mt-3 font-extrabold">Tournament-specific questions</h2>
          <p className="mt-1 text-sm text-muted">Each tournament page lists the organiser&apos;s direct phone and email — they&apos;re the fastest route for schedule and venue questions.</p>
        </Card>
      </div>
    </>
  );
}
