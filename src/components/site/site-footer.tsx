import Link from "next/link";
import Image from "next/image";
import { Mail, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon, XIcon, YoutubeIcon } from "@/components/site/social-icons";

const contact = {
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@tournamenthub.in",
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE || "+91 90000 00000",
};

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-navy text-white/75">
      <div className="h-1 bg-gradient-to-r from-brand via-brand to-accent" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:px-8">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/brand/logo-icon.png" alt="" width={44} height={44} className="rounded-lg" />
            <span className="display text-3xl italic text-white">
              Tournament<span className="text-brand">Hub</span>
            </span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            The home of grassroots and competitive sport. Discover tournaments, register in minutes, pay securely and follow every rally of your journey.
          </p>
          <div className="mt-5 flex gap-2">
            {[
              { icon: InstagramIcon, label: "Instagram", href: "https://instagram.com" },
              { icon: YoutubeIcon, label: "YouTube", href: "https://youtube.com" },
              { icon: FacebookIcon, label: "Facebook", href: "https://facebook.com" },
              { icon: XIcon, label: "X", href: "https://x.com" },
            ].map(({ icon: Icon, label, href }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-10 place-items-center rounded-xl bg-white/5 transition hover:bg-accent hover:text-white">
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
        <FooterCol title="Platform" links={[["Tournaments", "/tournaments"], ["How it works", "/#how-it-works"], ["Highlights", "/#highlights"], ["My dashboard", "/dashboard"]]} />
        <FooterCol title="Company" links={[["About us", "/about"], ["Contact", "/contact"], ["Terms & conditions", "/terms"], ["Privacy policy", "/privacy"], ["Refund policy", "/refund-policy"]]} />
        <div>
          <h3 className="eyebrow text-white">Organiser contact</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2.5 hover:text-white">
                <Mail className="size-4 text-accent" /> {contact.email}
              </a>
            </li>
            <li>
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="flex items-center gap-2.5 hover:text-white">
                <Phone className="size-4 text-accent" /> {contact.phone}
              </a>
            </li>
          </ul>
          <p className="mt-4 text-xs text-white/50">Hosting a tournament? Get in touch to run it on TournamentHub.</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} TournamentHub. All rights reserved.</p>
          <p className="eyebrow text-[0.65rem] text-white/40">Discover · Register · Compete</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="eyebrow text-white">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([l, h]) => (
          <li key={h}>
            <Link href={h} className="transition hover:text-white">
              {l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
