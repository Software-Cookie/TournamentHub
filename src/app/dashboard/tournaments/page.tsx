import Link from "next/link";
import Image from "next/image";
import { CalendarDays, MapPin, Ticket, Trophy } from "lucide-react";
import { requireUser } from "@/lib/authz";
import { myRegistrations } from "@/server/queries/player";
import { ButtonLink, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { CourtArt } from "@/components/court-art";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "My tournaments" };

export default async function MyTournamentsPage() {
  const user = await requireUser("/dashboard/tournaments");
  const regs = (await myRegistrations(user)).filter((r) => r.status !== "EXPIRED" || r.payments[0]?.status === "PAID");
  return (
    <>
      <PageHeader eyebrow="Registrations" title="My tournaments" description="Every tournament you've entered, with payment and ticket status." />
      {regs.length === 0 ? (
        <EmptyState icon={<Trophy className="size-6" />} title="You haven't registered yet" action={<ButtonLink href="/tournaments" variant="accent">Explore tournaments</ButtonLink>}>
          Once you register, your entries and tickets live here.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {regs.map((r) => (
            <Link key={r.id} href={`/dashboard/registrations/${r.id}`} className="card group flex overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="relative hidden w-32 shrink-0 bg-navy sm:block">
                {r.tournament.bannerUrl ? <Image src={r.tournament.bannerUrl} alt="" fill sizes="128px" className="object-cover" /> : <CourtArt seed={r.tournament.slug} />}
              </div>
              <div className="min-w-0 flex-1 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-extrabold group-hover:text-brand">{r.tournament.name}</p>
                    <p className="truncate text-sm text-muted">
                      {r.category.name}
                      {r.team ? ` · ${r.team.name}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                  <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{formatDate(r.tournament.startDate)}</span>
                  <span className="flex items-center gap-1.5 truncate"><MapPin className="size-3.5" />{r.tournament.venue?.name ?? "TBA"}</span>
                  <span className="flex items-center gap-1.5">
                    Payment: <StatusBadge status={r.amount === 0 ? "PAID" : (r.payments[0]?.status ?? "PENDING")} className="!px-1.5 !py-0 !text-[0.65rem]" />
                  </span>
                  <span className="flex items-center gap-1.5"><Ticket className="size-3.5" />{r.ticket && !r.ticket.revokedAt ? r.ticket.number : "—"}</span>
                </div>
                <p className="mt-2 font-mono text-[0.7rem] text-subtle">
                  {r.code} · {r.amount === 0 ? "Free" : formatMoney(r.amount)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
