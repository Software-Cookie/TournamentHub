import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarDays, Clock, Download, Mail, MapPin, Navigation, Phone, Receipt, Users } from "lucide-react";
import { canAccessRegistration, requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { DEFAULT_INSTRUCTIONS, qrDataUrl } from "@/lib/tickets";
import { registrationWindow } from "@/server/registrations";
import { Badge, Card, StatusBadge } from "@/components/ui";
import { PayNow } from "@/components/payments/pay-now";
import { PaymentSuccess } from "@/components/payments/payment-success";
import { formatDate, formatDateTime, formatMoney, mapsLink } from "@/lib/utils";

export const metadata = { title: "Registration" };
export const dynamic = "force-dynamic";

export default async function RegistrationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ paid?: string; submitted?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/dashboard/registrations/${id}`);
  if (!(await canAccessRegistration(user, id))) notFound();

  const r = await db.registration.findUnique({
    where: { id },
    include: {
      tournament: { include: { venue: true, organiser: true } },
      category: true,
      team: { include: { members: { include: { participant: true }, orderBy: { slot: "asc" } } } },
      participants: { orderBy: { createdAt: "asc" } },
      ticket: true,
      payments: { orderBy: { createdAt: "desc" }, include: { refunds: { orderBy: { createdAt: "desc" } } } },
    },
  });
  if (!r) notFound();
  const t = r.tournament;
  const isOwner = r.userId === user.id;
  const ticketValid = r.status === "CONFIRMED" && r.ticket && !r.ticket.revokedAt;
  const qr = ticketValid ? await qrDataUrl(r.ticket!.qrToken) : null;
  const regWindow = registrationWindow(t);
  const canPay = isOwner && (r.status === "PENDING_PAYMENT" || (r.status === "EXPIRED" && regWindow.open)) && r.amount > 0;
  const holdActive = r.status === "PENDING_PAYMENT" && r.expiresAt && r.expiresAt > new Date();
  const maps = mapsLink(t.venue);
  const paid = r.payments.find((p) => ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "REFUND_PENDING"].includes(p.status));

  return (
    <>
      {sp.paid && r.status === "CONFIRMED" && <PaymentSuccess registrationId={r.id} tournamentName={t.name} categoryName={r.category.name} code={r.code} />}
      {(sp.paid || sp.submitted) && r.status === "PENDING_APPROVAL" && <PaymentSuccess registrationId={r.id} tournamentName={t.name} categoryName={r.category.name} code={r.code} awaitingApproval />}

      <Link href="/dashboard/tournaments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> My tournaments
      </Link>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow text-accent">{r.category.name}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.name}</h1>
          <p className="mt-1 font-mono text-sm text-subtle">Registration {r.code}</p>
        </div>
        <StatusBadge status={r.status} className="self-start text-sm" />
      </div>

      {/* Status-specific banners */}
      {canPay && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60 p-5">
          <h2 className="font-extrabold">{r.status === "EXPIRED" ? "Your slot hold expired" : "Complete your payment"}</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            {r.status === "EXPIRED" ? "Payment wasn't completed in time, so the slot was released. If slots are still available you can pay now to confirm." : "Your slot is reserved for a limited time. Pay now to confirm your entry and receive your ticket."}
          </p>
          <PayNow registrationId={r.id} amount={r.amount} expiresAt={holdActive ? r.expiresAt!.toISOString() : null} retry={r.payments.some((p) => p.status === "FAILED")} />
        </Card>
      )}
      {r.status === "PENDING_APPROVAL" && (
        <Card className="mb-6 border-violet-200 bg-violet-50/60 p-5 text-sm">
          <strong>Awaiting organiser approval.</strong> Your payment is safe. You&apos;ll receive your ticket by email as soon as the organiser approves your entry.
        </Card>
      )}
      {(r.status === "CANCELLED" || r.status === "REJECTED") && (
        <Card className="mb-6 border-red-200 bg-red-50/60 p-5 text-sm">
          <p className="flex items-center gap-2 font-bold text-red-700"><AlertTriangle className="size-4" /> This registration was {r.status === "REJECTED" ? "declined" : "cancelled"}.</p>
          {r.adminNote && <p className="mt-1 text-muted">Reason: {r.adminNote}</p>}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Ticket */}
        <div id="ticket" className="scroll-mt-24">
          {ticketValid ? (
            <div className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-line">
              <div className="relative overflow-hidden bg-navy px-6 pb-6 pt-5 text-white">
                <div className="court-pattern absolute inset-0 opacity-40" aria-hidden />
                <div className="relative flex items-center justify-between">
                  <Image src="/brand/logo-icon.png" alt="TournamentHub" width={40} height={40} className="rounded-lg" />
                  <span className="eyebrow text-[0.65rem] text-accent">Official entry ticket</span>
                </div>
                <h2 className="display relative mt-4 text-3xl italic">{t.name}</h2>
                <p className="relative mt-1 text-sm font-semibold text-brand-100">{r.category.name}</p>
              </div>
              <div className="relative grid gap-5 p-6 sm:grid-cols-[1fr_auto]">
                <span className="absolute -left-3 top-0 size-6 -translate-y-1/2 rounded-full bg-canvas" aria-hidden />
                <span className="absolute -right-3 top-0 size-6 -translate-y-1/2 rounded-full bg-canvas" aria-hidden />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {r.team && <TicketField label="Team" value={r.team.name} span />}
                  <TicketField label={r.participants.length > 1 ? "Players" : "Player"} value={r.participants.map((p) => p.fullName).join(" & ")} span />
                  <TicketField label="Date" value={formatDate(t.startDate, { weekday: "short" })} />
                  <TicketField label="First match" value={t.matchStartTime ?? "TBA"} />
                  <TicketField label="Venue" value={t.venue ? `${t.venue.name}, ${t.venue.city}` : "TBA"} span />
                  <TicketField label="Registration ID" value={r.code} mono />
                  <TicketField label="Ticket no." value={r.ticket!.number} mono />
                  <div className="col-span-2">
                    <dt className="text-[0.68rem] font-bold uppercase tracking-wider text-subtle">Payment</dt>
                    <dd className="mt-0.5"><Badge tone="green">{r.amount === 0 ? "No fee · Confirmed" : `Paid · ${formatMoney(r.amount)}`}</Badge></dd>
                  </div>
                </dl>
                <div className="text-center">
                  <Image src={qr!} alt="Ticket QR code" width={160} height={160} unoptimized className="mx-auto size-40 rounded-xl border border-line p-1" />
                  <p className="mt-1 text-[0.68rem] text-subtle">Scan at registration desk</p>
                  {r.ticket!.checkedInAt && <p className="mt-1 text-xs font-bold text-success">✓ Checked in {formatDateTime(r.ticket!.checkedInAt)}</p>}
                </div>
              </div>
              <div className="mx-6 mb-6 rounded-xl border-l-4 border-accent bg-accent-50 p-4 text-sm leading-relaxed">
                <p className="eyebrow mb-1 text-[0.65rem] text-accent-600">Important participant instructions</p>
                {t.participantInstructions || DEFAULT_INSTRUCTIONS}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-line p-4">
                <a href={`/api/tickets/${r.id}/pdf`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-700">
                  <Download className="size-4" /> Download PDF
                </a>
                {maps && (
                  <a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 font-semibold hover:bg-canvas">
                    <Navigation className="size-4" /> Directions
                  </a>
                )}
              </div>
            </div>
          ) : (
            <Card className="p-6 text-center">
              <p className="font-bold">Ticket not issued yet</p>
              <p className="mt-1 text-sm text-muted">Your digital ticket is generated automatically once the registration is confirmed.</p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-extrabold"><CalendarDays className="size-4 text-brand" /> Event details</h2>
            <ul className="space-y-2.5 text-sm">
              <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0 text-subtle" />{formatDate(t.startDate, { weekday: "long" })}{t.matchStartTime ? ` · from ${t.matchStartTime}` : ""}</li>
              {t.venue && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-subtle" />{t.venue.name}, {t.venue.addressLine}, {t.venue.city}</li>}
              {t.organiser && (
                <>
                  <li className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0 text-subtle" /><a href={`tel:${t.organiser.phone}`} className="hover:text-brand">{t.organiser.name} · {t.organiser.phone}</a></li>
                  <li className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-subtle" /><a href={`mailto:${t.organiser.email}`} className="hover:text-brand">{t.organiser.email}</a></li>
                </>
              )}
            </ul>
            <Link href={`/tournaments/${t.slug}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Tournament page →</Link>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-extrabold"><Users className="size-4 text-brand" /> {r.team ? "Team" : "Participant"}</h2>
            {r.team && (
              <div className="mb-3 rounded-xl bg-canvas p-3 text-sm">
                <p className="font-bold">{r.team.name}</p>
                <p className="text-muted">Captain: {r.team.captainName} · {r.team.captainPhone}</p>
              </div>
            )}
            <ul className="divide-y divide-line text-sm">
              {r.participants.map((p, i) => (
                <li key={p.id} className="py-2.5">
                  <p className="font-semibold">{r.participants.length > 1 ? `Player ${i + 1}: ` : ""}{p.fullName}</p>
                  <p className="text-muted">{p.email} · {p.phone}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-extrabold"><Receipt className="size-4 text-brand" /> Payment receipt</h2>
            {r.amount === 0 ? (
              <p className="text-sm text-muted">This category has no entry fee.</p>
            ) : r.payments.length === 0 ? (
              <p className="text-sm text-muted">No payment attempts yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {r.payments.map((p) => (
                  <li key={p.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-extrabold">{formatMoney(p.amount)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="text-subtle">Order</dt>
                      <dd className="truncate font-mono">{p.providerOrderId}</dd>
                      {p.providerPaymentId && (<><dt className="text-subtle">Payment ID</dt><dd className="truncate font-mono">{p.providerPaymentId}</dd></>)}
                      {p.method && (<><dt className="text-subtle">Method</dt><dd className="uppercase">{p.method}</dd></>)}
                      <dt className="text-subtle">{p.paidAt ? "Paid at" : "Created"}</dt>
                      <dd>{formatDateTime(p.paidAt ?? p.createdAt)}</dd>
                      {p.failureReason && (<><dt className="text-subtle">Reason</dt><dd className="text-danger">{p.failureReason}</dd></>)}
                    </dl>
                    {p.refunds.map((rf) => (
                      <p key={rf.id} className="mt-2 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs text-violet-800">
                        Refund {formatMoney(rf.amount)} · {rf.status.toLowerCase()} · {formatDate(rf.createdAt)}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            {paid && <p className="mt-3 text-xs text-subtle">Payments processed by Razorpay. Keep the payment ID for any queries.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

function TicketField({ label, value, span, mono }: { label: string; value: string; span?: boolean; mono?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <dt className="text-[0.68rem] font-bold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className={`mt-0.5 font-bold ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
