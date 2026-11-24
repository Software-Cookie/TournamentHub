/**
 * One-time, protected provisioning of the platform administrator.
 *
 *   ADMIN_EMAIL=... ADMIN_INITIAL_PASSWORD=... npm run admin:create
 *
 * - Creates the account (email pre-verified) with role SUPER_ADMIN, or promotes an existing account.
 * - An existing account's password is only changed when --reset-password is passed.
 * - Remove ADMIN_INITIAL_PASSWORD from the environment afterwards. No password is ever stored in code.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD ?? "";
  const reset = process.argv.includes("--reset-password");
  if (!email) throw new Error("Set ADMIN_EMAIL.");

  const existing = await db.user.findUnique({ where: { email } });
  const needPassword = !existing || reset || !existing.passwordHash;
  if (needPassword) {
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      throw new Error("ADMIN_INITIAL_PASSWORD must be at least 12 characters and include letters and numbers.");
  }
  const passwordHash = needPassword ? await bcrypt.hash(password, 12) : undefined;

  const user = await db.user.upsert({
    where: { email },
    create: { email, name: "Platform Admin", role: "SUPER_ADMIN", emailVerified: new Date(), passwordHash },
    update: { role: "SUPER_ADMIN", ...(passwordHash ? { passwordHash, sessionVersion: { increment: 1 } } : {}), emailVerified: existing?.emailVerified ?? new Date() },
  });
  const org = await db.organisation.upsert({ where: { slug: "tournamenthub" }, create: { slug: "tournamenthub", name: "TournamentHub", plan: "INTERNAL" }, update: {} });
  await db.organisationMember.upsert({
    where: { organisationId_userId: { organisationId: org.id, userId: user.id } },
    create: { organisationId: org.id, userId: user.id, role: "OWNER" },
    update: { role: "OWNER" },
  });
  await db.auditLog.create({ data: { actorId: user.id, action: existing ? "admin.promoted" : "admin.created", entityType: "User", entityId: user.id } });
  console.log(`✔ ${existing ? "Updated" : "Created"} platform administrator ${email}${needPassword ? " (password set)" : ""}.`);
  if (needPassword) console.log("  → Now remove ADMIN_INITIAL_PASSWORD from your environment and sign in at /login.");
}

main()
  .catch((e) => {
    console.error("✖", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
