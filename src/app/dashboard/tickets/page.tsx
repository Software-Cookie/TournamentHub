import Link from "next/link";
import Image from "next/image";
import { Download, Ticket } from "lucide-react";
import { requireUser, myRegistrationWhere } from "@/lib/authz";
import { db } from "@/lib/db";
import { qrDataUrl } from "@/lib/tickets";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "My tickets" };

export default async function TicketsPage() {
  const user = await requireUser("/dashboard/tickets");
  const regs = await db.registration.findMany({
    where: { status: "CONFIRMED", ticket: { isNot: null }, ...(await myRegistrationWhere(user)) },
    include: { ticket: true, category: true, team: true, participants: { orderBy: { createdAt: "asc" } }, tournament: { include: { venue: true } } },
    orderBy: { tournament: { startDate: "desc" } },
  });
  const qrs = await Promise.all(regs.map((r) => qrDataUrl(r.ticket!.qrToken)));
  return (
    <>
      <PageHeader eyebrow="Tickets" title="My tickets" description="Show the QR code at the registration desk. Download a PDF copy for offline use." />
      {regs.length === 0 ? (
        <EmptyState icon={<Ticket className="size-6" />} title="No tickets yet" action={<ButtonLink href="/tournaments">Find a tournament</ButtonLink>}>
          Tickets are issued automatically once your payment is verified.
        </EmptyState>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {regs.map((r, i) => (
            <div key={r.id} className="card overflow-hidden">
              <div className="bg-navy px-5 py-4 text-white">
                <p className="eyebrow text-[0.65rem] text-accent">{r.category.name}</p>
                <p className="mt-0.5 truncate font-extrabold">{r.tournament.name}</p>
                <p className="text-xs text-white/60">{formatDate(r.tournament.startDate, { weekday: "short" })} · {r.tournament.venue?.name}</p>
              </div>
              <div className="relative flex items-center gap-4 border-b border-dashed border-line p-5">
                <span className="absolute -left-3 -bottom-3 size-6 rounded-full bg-canvas" aria-hidden />
                <span className="absolute -right-3 -bottom-3 size-6 rounded-full bg-canvas" aria-hidden />
                <Image src={qrs[i]!} alt={`QR code for ticket ${r.ticket!.number}`} width={112} height={112} unoptimized className="size-28 rounded-lg border border-line" />
                <div className="min-w-0 text-sm">
                  <p className="text-xs text-subtle">{r.team ? "Team" : "Player"}</p>
                  <p className="truncate font-bold">{r.team?.name ?? r.participants[0]?.fullName}</p>
                  <p className="mt-2 text-xs text-subtle">Ticket no.</p>
                  <p className="font-mono text-xs font-bold">{r.ticket!.number}</p>
                  {r.ticket!.checkedInAt && <p className="mt-1 text-xs font-bold text-success">✓ Checked in</p>}
                </div>
              </div>
              <div className="flex gap-2 p-4">
                <Link href={`/dashboard/registrations/${r.id}`} className="flex-1 rounded-xl border border-line py-2 text-center text-sm font-semibold hover:bg-canvas">Details</Link>
                <a href={`/api/tickets/${r.id}/pdf`} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-sm font-semibold text-white hover:bg-brand-700">
                  <Download className="size-4" /> PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
