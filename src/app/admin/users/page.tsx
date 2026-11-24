import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { Badge, Card, PageHeader } from "@/components/ui";
import { UserActions } from "@/components/admin/user-actions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireAdmin();
  const { q } = await searchParams;
  const where: Prisma.UserWhereInput = q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {};
  const users = await db.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { _count: { select: { registrations: true } } } });
  return (
    <>
      <PageHeader eyebrow="Access" title="Users & roles" description="Only the platform owner can grant admin access. Role changes sign the user out immediately." />
      <form className="mb-4">
        <input name="q" defaultValue={q} className="input max-w-md" placeholder="Search by name or email…" aria-label="Search users" />
      </form>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-left text-xs font-bold uppercase tracking-wider text-subtle">
              <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Verified</th><th className="px-4 py-3 text-right">Registrations</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><p className="font-bold">{u.name ?? "—"} {u.isDemo && <Badge className="ml-1">Sample</Badge>}</p><p className="text-xs text-subtle">{u.email}</p></td>
                  <td className="px-4 py-3"><Badge tone={u.role === "PLAYER" ? "gray" : u.role === "SUPER_ADMIN" ? "dark" : "orange"}>{u.role.replace("_", " ").toLowerCase()}</Badge>{u.isDisabled && <Badge tone="red" className="ml-1">Disabled</Badge>}</td>
                  <td className="px-4 py-3">{u.emailVerified ? <Badge tone="green">Yes</Badge> : <Badge tone="yellow">Pending</Badge>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{u._count.registrations}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">{u.id !== me.id && u.role !== "SUPER_ADMIN" && <UserActions userId={u.id} role={u.role} disabled={u.isDisabled} canChangeRole={me.role === "SUPER_ADMIN"} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
