import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertUser } from "@/lib/authz";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { startPayment } from "@/server/registrations";
import { startListingPayment } from "@/server/listings";
import { startMembershipPayment } from "@/server/membership";

const schema = z.union([
  z.object({ registrationId: z.string().min(1).max(40) }),
  z.object({ listingTournamentId: z.string().min(1).max(40) }),
  z.object({ membershipPlan: z.enum(["MONTHLY", "YEARLY"]) }),
]);

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await assertUser();
    if (!(await rateLimit(`pay-order:${user.id}`, 10, 300))) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
    const body = schema.parse(await req.json());
    const order =
      "registrationId" in body
        ? await startPayment(user, body.registrationId)
        : "listingTournamentId" in body
          ? await startListingPayment(user, body.listingTournamentId)
          : await startMembershipPayment(user, body.membershipPlan);
    return NextResponse.json(order);
  } catch (e) {
    return jsonError(e);
  }
}
