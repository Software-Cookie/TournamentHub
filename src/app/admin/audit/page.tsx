import { requireAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const logs = await db.auditLog.findMany({
    where: q ? { OR: [{ action: { contains: q, mode: "insensitive" } }, { entityId: q }] } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { email: true } } },
  });
  return (
    <>
      <PageHeader eyebrow="Security" title="Audit log" description="Every sensitive action — payments, refunds, results, role changes, exports — is recorded here permanently." />
      <form className="mb-4"><input name="q" defaultValue={q} className="input max-w-md" placeholder="Filter by action (e.g. refund, match) or entity ID…" aria-label="Filter" /></form>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
              <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-2.5 text-xs">{l.actor?.email ?? "system"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{l.action}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{l.entityType}{l.entityId ? ` · ${l.entityId.slice(0, 10)}…` : ""}</td>
                  <td className="max-w-sm px-4 py-2.5 font-mono text-[0.7rem] text-subtle"><span className="line-clamp-2 break-all">{l.metadata ? JSON.stringify(l.metadata) : ""}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
