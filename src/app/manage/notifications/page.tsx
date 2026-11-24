import { manageScope, requireManager } from "@/lib/authz";
import { db } from "@/lib/db";
import { entryName } from "@/server/fixtures";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Communication" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireManager("/manage/notifications");
  const scope = await manageScope(user);
  const tournaments = await db.tournament.findMany({
    where: { ...scope, status: { in: ["PUBLISHED", "ONGOING", "COMPLETED"] } },
    orderBy: { startDate: "desc" },
    include: {
      categories: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
      registrations: { where: { status: { in: ["CONFIRMED", "PENDING_APPROVAL"] } }, include: { team: true, participants: { select: { fullName: true } }, category: { select: { name: true } } } },
    },
  });
  const [history, logs, failed] = await Promise.all([
    db.notification.findMany({ where: { tournament: scope }, orderBy: { createdAt: "desc" }, take: 20, include: { tournament: { select: { name: true } } } }),
    db.emailLog.findMany({ where: { tournament: scope }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.emailLog.count({ where: { status: "FAILED", tournament: scope } }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Communication" title="Notify participants" description="Email all participants, a category, specific teams or selected players. Each person receives the message once." />
      <BroadcastComposer
        tournaments={tournaments.map((t) => ({
          id: t.id,
          name: t.name,
          categories: t.categories,
          entries: t.registrations.map((r) => ({ id: r.id, label: `${entryName(r)} · ${r.category.name}`, isTeam: !!r.team })),
        }))}
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 font-extrabold">Sent announcements</h2>
          <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
            {history.map((n) => (
              <li key={n.id} className="px-5 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{n.subject}</p>
                  <Badge tone="blue">{n.channel.toLowerCase()}</Badge>
                </div>
                <p className="text-xs text-subtle">{n.tournament.name} · {n.audience.toLowerCase()} · {formatDateTime(n.createdAt)}</p>
                <p className="mt-1 text-xs"><span className="text-success">{n.sentCount} sent</span>{n.failedCount ? <span className="text-danger"> · {n.failedCount} failed</span> : null} · {n.recipientCount} recipients</p>
              </li>
            ))}
            {history.length === 0 && <li className="px-5 py-6 text-center text-sm text-subtle">No announcements yet.</li>}
          </ul>
        </Card>
        <Card className="overflow-hidden">
          <h2 className="flex items-center justify-between border-b border-line px-5 py-3 font-extrabold">
            Email delivery log {failed > 0 && <Badge tone="red">{failed} failed · auto-retrying</Badge>}
          </h2>
          <ul className="max-h-[480px] divide-y divide-line overflow-y-auto">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{l.subject}</p>
                  <p className="truncate text-subtle">{l.to} · {l.template} · {formatDateTime(l.createdAt)}{l.error ? ` · ${l.error}` : ""}</p>
                </div>
                <StatusBadge status={l.status === "SENT" ? "COMPLETED" : l.status === "FAILED" ? "FAILED" : "PENDING"} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
