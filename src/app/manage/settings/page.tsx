import { requireManager } from "@/lib/authz";
import { db } from "@/lib/db";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { OrganiserForm } from "@/components/organiser/organiser-form";

export const metadata = { title: "Organiser profile" };
export const dynamic = "force-dynamic";

export default async function OrganiserSettingsPage() {
  const user = await requireManager("/manage/settings");
  const member = await db.organisationMember.findFirst({ where: { userId: user.id }, include: { organisation: true } });
  if (!member) {
    return (
      <>
        <PageHeader title="Organiser profile" />
        <EmptyState title="No organiser profile">Platform admins manage tournaments under the platform organisation.</EmptyState>
      </>
    );
  }
  const o = member.organisation;
  return (
    <>
      <PageHeader title="Organiser profile" description="Shown on your tournament pages. Payout details are only visible to you and the platform team." />
      <Card className="max-w-3xl p-6">
        {member.role === "OWNER" || member.role === "MANAGER" ? (
          <OrganiserForm mode="update" values={{ name: o.name, contactEmail: o.contactEmail ?? "", contactPhone: o.contactPhone ?? "", city: o.city ?? "", about: o.about ?? "", payoutUpi: o.payoutUpi ?? "", payoutAccount: o.payoutAccount ?? "" }} />
        ) : (
          <p className="text-sm text-muted">Only the organisation owner can edit these details.</p>
        )}
      </Card>
    </>
  );
}
