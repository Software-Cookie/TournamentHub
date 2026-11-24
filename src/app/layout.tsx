import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import { RevealObserver } from "@/components/reveal-observer";
import "./globals.css";

const body = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["700", "800"], style: ["normal", "italic"], variable: "--font-display-face", display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "TournamentHub — Discover. Register. Compete.", template: "%s · TournamentHub" },
  description: "Find and enter badminton, cricket, football, tennis, volleyball and more tournaments near you — or host your own. Secure payments, digital tickets and live brackets.",
  openGraph: { type: "website", siteName: "TournamentHub", images: ["/brand/logo-wide.png"] },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#030b25", width: "device-width", initialScale: 1 };

// Runs before paint: enables JS-only enhancements and skips the splash after the first visit.
const bootstrap = `document.documentElement.classList.add('js');try{if(sessionStorage.getItem('th:splash'))document.documentElement.classList.add('splash-seen');else sessionStorage.setItem('th:splash','1')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${body.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <div className="splash" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-icon.png" alt="" width={120} height={120} className="rounded-3xl" />
        </div>
        {children}
        <RevealObserver />
        <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-body)" } }} />
      </body>
    </html>
  );
}
