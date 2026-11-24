import { NextResponse, type NextRequest } from "next/server";
import { canAccessRegistration, getCurrentUser } from "@/lib/authz";
import { renderTicketPdf } from "@/lib/tickets";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!(await canAccessRegistration(user, registrationId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderTicketPdf(registrationId);
  if (!pdf) return NextResponse.json({ error: "Ticket not available yet." }, { status: 404 });
  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
