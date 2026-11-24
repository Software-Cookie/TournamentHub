import { NextResponse, type NextRequest } from "next/server";
import { AuthzError, assertUser, getMemberOrgIds, isAdminRole } from "@/lib/authz";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { uploadImage, UploadError } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await assertUser();
    // Admins and organisers (members of an organisation) may upload tournament media.
    if (!isAdminRole(user.role) && (await getMemberOrgIds(user.id)).length === 0) throw new AuthzError(403);
    if (!(await rateLimit(`upload:${user.id}`, 60, 600))) return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });
    const form = await req.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "tournaments").replace(/[^a-z0-9-]/gi, "").slice(0, 30) || "tournaments";
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    const result = await uploadImage(file, folder);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    return jsonError(e);
  }
}
