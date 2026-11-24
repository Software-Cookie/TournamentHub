import "server-only";
import { env } from "@/lib/env";

// ─── Helpers ──────────────────────────────────────────────────

export function esc(s: string | null | undefined) {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain text → safe HTML paragraphs. */
export function textToHtml(s: string | null | undefined) {
  return esc(s)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

const C = { navy: "#0B1838", blue: "#2D5AB8", orange: "#D9783F", bg: "#F4F6FA", text: "#121C36", muted: "#4C5875", border: "#DFE4EE", green: "#2F8A5B", red: "#B9483D" };

function abs(url: string | null | undefined) {
  if (!url) return null;
  return url.startsWith("http") ? url : `${env.appUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function button(label: string, href: string, color = C.orange) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="border-radius:10px;background:${color}">
  <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-weight:700;font-size:15px;color:#fff;text-decoration:none;border-radius:10px">${esc(label)}</a>
  </td></tr></table>`;
}

export function detailsTable(rows: [string, string | null | undefined][]) {
  const body = rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) => `<tr>
      <td style="padding:9px 0;color:${C.muted};font-size:13px;width:38%;vertical-align:top;border-bottom:1px solid ${C.border}">${esc(k)}</td>
      <td style="padding:9px 0;font-size:14px;font-weight:600;color:${C.text};border-bottom:1px solid ${C.border}">${v}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 6px">${body}</table>`;
}

export function callout(html: string, tone: "info" | "warn" | "success" | "danger" = "info") {
  const map = { info: ["#EFF6FF", C.blue], warn: ["#FFF7ED", C.orange], success: ["#F0FDF4", C.green], danger: ["#FEF2F2", C.red] } as const;
  const [bg, bar] = map[tone];
  return `<div style="background:${bg};border-left:4px solid ${bar};border-radius:8px;padding:14px 16px;margin:18px 0;font-size:14px;line-height:1.6;color:${C.text}">${html}</div>`;
}

type LayoutInput = { preheader: string; heading: string; eyebrow?: string; bannerUrl?: string | null; body: string; accent?: string; footerNote?: string };

export function layout({ preheader, heading, eyebrow, bannerUrl, body, accent = C.orange, footerNote }: LayoutInput) {
  const logo = `${env.appUrl}/brand/logo-wide.png`;
  const banner = abs(bannerUrl);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${C.text}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(16,24,40,.06)">
  <tr><td style="background:${C.navy};padding:18px 24px" align="left">
    <a href="${env.appUrl}" style="text-decoration:none"><img src="${logo}" alt="TournamentHub" height="44" style="display:block;height:44px;width:auto;border:0"></a>
  </td></tr>
  <tr><td style="height:4px;background:linear-gradient(90deg,${C.blue},${accent});background-color:${accent}"></td></tr>
  ${banner ? `<tr><td><img src="${esc(banner)}" alt="" width="600" style="display:block;width:100%;max-height:220px;object-fit:cover;border:0"></td></tr>` : ""}
  <tr><td style="padding:30px 28px 10px">
    ${eyebrow ? `<div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:${accent};margin-bottom:8px">${esc(eyebrow)}</div>` : ""}
    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:${C.navy}">${esc(heading)}</h1>
    <div style="font-size:15px;line-height:1.6;color:${C.text}">${body}</div>
  </td></tr>
  <tr><td style="padding:18px 28px 28px;color:${C.muted};font-size:12px;line-height:1.6;border-top:1px solid ${C.border}">
    ${footerNote ? `${esc(footerNote)}<br/>` : ""}
    You're receiving this because you have an account or registration on TournamentHub.<br/>
    <a href="${env.appUrl}/dashboard" style="color:${C.blue}">Your dashboard</a> · <a href="${env.appUrl}/privacy" style="color:${C.blue}">Privacy</a> · <a href="${env.appUrl}/contact" style="color:${C.blue}">Contact</a>
  </td></tr>
</table>
<div style="font-size:11px;color:#98A2B3;margin-top:14px">© ${new Date().getFullYear()} TournamentHub · Discover. Register. Compete.</div>
</td></tr></table></body></html>`;
}

// ─── Templates ────────────────────────────────────────────────

export function verifyEmailTemplate(name: string | null, url: string) {
  return {
    subject: "Verify your TournamentHub email",
    html: layout({
      preheader: "Confirm your email to start registering for tournaments.",
      eyebrow: "Welcome aboard",
      heading: `Hi ${name || "there"}, confirm your email`,
      body: `<p>Thanks for creating a TournamentHub account. Please confirm this email address so we can send your tickets and match updates.</p>
      ${button("Verify email", url, C.blue)}
      <p style="font-size:13px;color:${C.muted}">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
    }),
  };
}

export function welcomeTemplate(name: string | null) {
  return {
    subject: "Welcome to TournamentHub 🏸",
    html: layout({
      preheader: "Your account is ready. Find your next tournament.",
      eyebrow: "Account ready",
      heading: `You're all set, ${name || "champion"}!`,
      body: `<p>Your email is verified and your account is active. Browse upcoming tournaments, register solo or with your partner, and keep every ticket and match in one place.</p>
      ${button("Explore tournaments", `${env.appUrl}/tournaments`)}`,
    }),
  };
}

export function passwordResetTemplate(name: string | null, url: string) {
  return {
    subject: "Reset your TournamentHub password",
    html: layout({
      preheader: "Use this link to choose a new password.",
      eyebrow: "Security",
      heading: "Reset your password",
      body: `<p>Hi ${esc(name) || "there"}, we received a request to reset your password.</p>
      ${button("Choose a new password", url, C.blue)}
      <p style="font-size:13px;color:${C.muted}">This link expires in 1 hour and can be used once. If you didn't request this, your password stays the same and you can ignore this email.</p>`,
    }),
  };
}

export type RegistrationEmailData = {
  participantName: string;
  teamName?: string | null;
  categoryName: string;
  tournamentName: string;
  tournamentDate: string;
  venueName?: string | null;
  venueAddress?: string | null;
  mapsUrl?: string | null;
  bannerUrl?: string | null;
  registrationCode: string;
  amount: string;
  ticketUrl: string;
  ticketNumber?: string;
  reportingTime?: string | null;
  instructions?: string | null;
  organiserLine?: string | null;
};

function regRows(d: RegistrationEmailData): [string, string | null | undefined][] {
  return [
    ["Tournament", esc(d.tournamentName)],
    ["Category", esc(d.categoryName)],
    ["Team", d.teamName ? esc(d.teamName) : null],
    ["Registration ID", `<span style="font-family:monospace">${esc(d.registrationCode)}</span>`],
    ["Date", esc(d.tournamentDate)],
    ["Reporting time", d.reportingTime ? esc(d.reportingTime) : null],
    ["Venue", d.venueName ? `${esc(d.venueName)}${d.venueAddress ? `<br/><span style="font-weight:400;color:${C.muted}">${esc(d.venueAddress)}</span>` : ""}${d.mapsUrl ? `<br/><a href="${esc(d.mapsUrl)}" style="color:${C.blue};font-weight:600">Open in Google Maps →</a>` : ""}` : null],
  ];
}

export function registrationReceivedTemplate(d: RegistrationEmailData & { awaitingApproval: boolean }) {
  return {
    subject: d.awaitingApproval ? `Registration received – ${d.tournamentName}` : `Complete your payment – ${d.tournamentName}`,
    html: layout({
      preheader: d.awaitingApproval ? "Your payment is confirmed. The organiser will review your entry shortly." : "Your spot is reserved for a short time — complete payment to confirm.",
      eyebrow: "Registration received",
      heading: d.awaitingApproval ? "Payment received — awaiting organiser approval" : "Your spot is on hold",
      bannerUrl: d.bannerUrl,
      body: `<p>Hi ${esc(d.participantName)},</p>
      <p>${d.awaitingApproval ? "We've received your registration and payment. The organiser reviews every entry for this tournament — we'll email your ticket as soon as it's approved." : "We've received your registration. Complete the payment to confirm your entry."}</p>
      ${detailsTable([...regRows(d), ["Amount", esc(d.amount)]])}
      ${button("View registration", d.ticketUrl)}`,
    }),
  };
}

export function ticketTemplate(d: RegistrationEmailData) {
  return {
    subject: `🎟️ You're in! Ticket for ${d.tournamentName}`,
    html: layout({
      preheader: `Registration confirmed for ${d.categoryName}. Your digital ticket is attached.`,
      eyebrow: "Registration confirmed",
      heading: "You're in. See you on court!",
      bannerUrl: d.bannerUrl,
      accent: C.green,
      body: `<p>Hi ${esc(d.participantName)},</p>
      <p>Your payment of <strong>${esc(d.amount)}</strong> was verified and your registration is <strong style="color:${C.green}">confirmed</strong>. Your digital ticket is attached as a PDF — you can also open it any time from your dashboard.</p>
      ${detailsTable([...regRows(d), ["Ticket no.", d.ticketNumber ? `<span style="font-family:monospace">${esc(d.ticketNumber)}</span>` : null], ["Payment", `<span style="color:${C.green}">Paid · ${esc(d.amount)}</span>`]])}
      ${callout(`<strong>Important:</strong> ${esc(d.instructions || "Please arrive at the venue at least 15 minutes before your scheduled match. Report to the registration desk for verification. Carry your ticket and a valid identification document.")}`, "warn")}
      ${button("View my ticket", d.ticketUrl)}
      ${d.organiserLine ? `<p style="font-size:13px;color:${C.muted}">Questions? ${esc(d.organiserLine)}</p>` : ""}`,
    }),
  };
}

export function paymentFailedTemplate(d: { participantName: string; tournamentName: string; categoryName: string; amount: string; retryUrl: string; reason?: string | null }) {
  return {
    subject: `Payment unsuccessful – ${d.tournamentName}`,
    html: layout({
      preheader: "Your payment did not go through. No money was taken, or it will be auto-refunded by your bank.",
      eyebrow: "Payment issue",
      heading: "Your payment didn't go through",
      accent: C.red,
      body: `<p>Hi ${esc(d.participantName)},</p>
      <p>We couldn't complete your payment of <strong>${esc(d.amount)}</strong> for <strong>${esc(d.categoryName)}</strong> at ${esc(d.tournamentName)}.${d.reason ? ` Reason: ${esc(d.reason)}.` : ""}</p>
      <p>If any amount was debited, it will be automatically reversed by your bank. You can retry while slots are available.</p>
      ${button("Retry payment", d.retryUrl)}`,
    }),
  };
}

export type MatchEmailData = {
  participantName: string;
  tournamentName: string;
  categoryName: string;
  roundName: string;
  opponent: string;
  when: string;
  court?: string | null;
  venueName?: string | null;
  mapsUrl?: string | null;
  matchesUrl: string;
  bannerUrl?: string | null;
};

export function matchScheduledTemplate(d: MatchEmailData, rescheduled = false) {
  return {
    subject: `${rescheduled ? "⏰ Match rescheduled" : "📅 Match scheduled"}: ${d.roundName} – ${d.tournamentName}`,
    html: layout({
      preheader: `${d.roundName} vs ${d.opponent} · ${d.when}`,
      eyebrow: rescheduled ? "Schedule change" : "Fixture announced",
      heading: rescheduled ? "Your match has been rescheduled" : "Your next match is set",
      bannerUrl: d.bannerUrl,
      accent: rescheduled ? C.orange : C.blue,
      body: `<p>Hi ${esc(d.participantName)},</p>
      ${detailsTable([
        ["Category", esc(d.categoryName)],
        ["Round", esc(d.roundName)],
        ["Opponent", esc(d.opponent)],
        [rescheduled ? "New time" : "Time", `<span style="color:${C.blue}">${esc(d.when)}</span>`],
        ["Court", d.court ? esc(d.court) : "To be announced"],
        ["Venue", d.venueName ? `${esc(d.venueName)}${d.mapsUrl ? ` · <a href="${esc(d.mapsUrl)}" style="color:${C.blue}">Map</a>` : ""}` : null],
      ])}
      ${callout("Please report to the registration desk at least 15 minutes before your match time.", "info")}
      ${button("Open match centre", d.matchesUrl, C.blue)}`,
    }),
  };
}

export function reminderTemplate(d: RegistrationEmailData & { hoursBefore: number; isDayOf: boolean }) {
  const heading = d.isDayOf ? "It's tournament day! 🏸" : `${d.tournamentName} starts ${d.hoursBefore >= 24 ? "tomorrow" : `in ${d.hoursBefore} hours`}`;
  return {
    subject: d.isDayOf ? `Today: ${d.tournamentName} — reporting details inside` : `Reminder: ${d.tournamentName} is coming up`,
    html: layout({
      preheader: `${d.categoryName} · ${d.tournamentDate}${d.reportingTime ? ` · report by ${d.reportingTime}` : ""}`,
      eyebrow: d.isDayOf ? "Game day" : "Tournament reminder",
      heading,
      bannerUrl: d.bannerUrl,
      body: `<p>Hi ${esc(d.participantName)},</p>
      <p>${d.isDayOf ? "Today's the day. Here's everything you need:" : "Get your kit ready — here are your tournament details:"}</p>
      ${detailsTable([...regRows(d), ["Ticket no.", d.ticketNumber ? `<span style="font-family:monospace">${esc(d.ticketNumber)}</span>` : null]])}
      ${callout(`<strong>Instructions:</strong> ${esc(d.instructions || "Please arrive at least 15 minutes before your scheduled match. Carry your ticket and a valid ID.")}`, "warn")}
      ${button("Show my ticket", d.ticketUrl)}`,
    }),
  };
}

export function resultTemplate(d: { participantName: string; tournamentName: string; categoryName: string; roundName: string; won: boolean; opponent: string; score: string; nextRound?: string | null; matchesUrl: string }) {
  return {
    subject: d.won ? `✅ You won your ${d.roundName} match – ${d.tournamentName}` : `Match result: ${d.roundName} – ${d.tournamentName}`,
    html: layout({
      preheader: `${d.won ? "Victory" : "Result"} vs ${d.opponent}: ${d.score}`,
      eyebrow: "Match result",
      heading: d.won ? (d.nextRound ? `Through to the ${d.nextRound}!` : "Victory!") : "Well played",
      accent: d.won ? C.green : C.blue,
      body: `<p>Hi ${esc(d.participantName)},</p>
      ${detailsTable([["Category", esc(d.categoryName)], ["Round", esc(d.roundName)], ["Opponent", esc(d.opponent)], ["Score", `<span style="font-family:monospace">${esc(d.score)}</span>`], ["Result", d.won ? `<span style="color:${C.green}">Won</span>` : "Lost"]])}
      <p>${d.won ? (d.nextRound ? `You've qualified for the <strong>${esc(d.nextRound)}</strong>. Keep an eye on the match centre for your next fixture.` : "Congratulations on the win!") : "Thanks for competing — we hope to see you at the next one."}</p>
      ${button("Open match centre", d.matchesUrl, C.blue)}`,
    }),
  };
}

export function winnerTemplate(d: { recipientName: string; tournamentName: string; categoryName: string; champion: string; runnerUp?: string | null; third?: string | null; isChampion: boolean; resultsUrl: string; bannerUrl?: string | null }) {
  return {
    subject: d.isChampion ? `🏆 Champion! ${d.categoryName} – ${d.tournamentName}` : `🏆 ${d.categoryName} results – ${d.tournamentName}`,
    html: layout({
      preheader: `${d.champion} wins ${d.categoryName}`,
      eyebrow: "Winner announcement",
      heading: d.isChampion ? `Congratulations, champion!` : `${d.categoryName}: we have a champion`,
      bannerUrl: d.bannerUrl,
      accent: "#EAB308",
      body: `<p>Hi ${esc(d.recipientName)},</p>
      ${detailsTable([["🥇 Champion", esc(d.champion)], ["🥈 Runner-up", d.runnerUp ? esc(d.runnerUp) : null], ["🥉 Third place", d.third ? esc(d.third) : null]])}
      <p>Thank you to every player who stepped on court. Prize distribution details will be shared by the organiser.</p>
      ${button("See full results", d.resultsUrl)}`,
    }),
  };
}

export function broadcastTemplate(d: { recipientName: string; tournamentName: string; subject: string; body: string; bannerUrl?: string | null; url: string }) {
  return {
    subject: `${d.subject} – ${d.tournamentName}`,
    html: layout({
      preheader: d.body.slice(0, 120),
      eyebrow: `Update from ${d.tournamentName}`,
      heading: d.subject,
      bannerUrl: d.bannerUrl,
      accent: C.blue,
      body: `<p>Hi ${esc(d.recipientName)},</p>${textToHtml(d.body)}${button("View tournament", d.url, C.blue)}`,
    }),
  };
}

export function listingReceiptTemplate(d: { name: string | null; tournamentName: string; sportName: string; amount: string; base: string; platformFee: string; gst: string; paymentId: string; manageUrl: string }) {
  return {
    subject: `Listing fee received – ${d.tournamentName}`,
    html: layout({
      preheader: `Your ${d.sportName} tournament can now be published.`,
      eyebrow: "Payment receipt",
      heading: "Your tournament is ready to publish",
      accent: C.green,
      body: `<p>Hi ${esc(d.name) || "there"},</p>
      <p>We've received the listing fee for <strong>${esc(d.tournamentName)}</strong>. Publish it whenever you're ready and players can start registering.</p>
      ${detailsTable([["Tournament", esc(d.tournamentName)], ["Sport", esc(d.sportName)], ["Listing fee", esc(d.base)], ["Platform charge (2%)", esc(d.platformFee)], ["GST (18%)", esc(d.gst)], ["Total paid", `<strong style="color:${C.green}">${esc(d.amount)}</strong>`], ["Payment ID", d.paymentId ? `<span style="font-family:monospace">${esc(d.paymentId)}</span>` : null]])}
      ${button("Open organiser console", d.manageUrl, C.blue)}
      <p style="font-size:13px;color:${C.muted}">Keep this email as your receipt.</p>`,
    }),
  };
}

export function registrationStatusTemplate(d: { participantName: string; tournamentName: string; categoryName: string; status: "REJECTED" | "CANCELLED"; reason?: string | null; refundLine?: string | null; url: string }) {
  return {
    subject: `Registration ${d.status === "REJECTED" ? "not approved" : "cancelled"} – ${d.tournamentName}`,
    html: layout({
      preheader: `Your ${d.categoryName} registration was ${d.status === "REJECTED" ? "not approved" : "cancelled"}.`,
      eyebrow: "Registration update",
      heading: d.status === "REJECTED" ? "Your registration wasn't approved" : "Your registration was cancelled",
      accent: C.red,
      body: `<p>Hi ${esc(d.participantName)},</p>
      <p>Your registration for <strong>${esc(d.categoryName)}</strong> at <strong>${esc(d.tournamentName)}</strong> has been ${d.status === "REJECTED" ? "declined by the organiser" : "cancelled"}.${d.reason ? ` Reason: ${esc(d.reason)}` : ""}</p>
      ${d.refundLine ? callout(esc(d.refundLine), "info") : ""}
      ${button("View details", d.url, C.blue)}`,
    }),
  };
}

export function premiumReceiptTemplate(d: { name: string | null; planLabel: string; amount: string; validUntil: string; paymentId: string; url: string }) {
  return {
    subject: "Welcome to TournamentHub Premium",
    html: layout({
      preheader: `Premium is active until ${d.validUntil}.`,
      eyebrow: "Payment receipt",
      heading: "You're a Premium member",
      accent: C.orange,
      body: `<p>Hi ${esc(d.name) || "there"},</p>
      <p>Your Premium membership is active. You can now register for premium events: tournaments with a prize pool above ₹30,000.</p>
      ${detailsTable([["Plan", esc(d.planLabel)], ["Amount paid", `<strong>${esc(d.amount)}</strong>`], ["Valid until", esc(d.validUntil)], ["Payment ID", d.paymentId ? `<span style="font-family:monospace">${esc(d.paymentId)}</span>` : null]])}
      ${button("Find premium events", d.url, C.blue)}
      <p style="font-size:13px;color:${C.muted}">Keep this email as your receipt. Premium does not renew automatically.</p>`,
    }),
  };
}
