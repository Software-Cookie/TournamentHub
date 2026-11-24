import { requireManager } from "@/lib/authz";
import { PageHeader } from "@/components/ui";
import { TicketScanner } from "@/components/admin/ticket-scanner";

export const metadata = { title: "Ticket scanner" };

export default async function ScanPage() {
  await requireManager("/manage/scan");
  return (
    <>
      <PageHeader eyebrow="Check-in" title="Ticket scanner" description="Scan a participant's QR code with this device's camera, or type the ticket number." />
      <TicketScanner />
    </>
  );
}
