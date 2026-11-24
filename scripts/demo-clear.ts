/** Remove all sample data created by prisma/seed-demo.ts (rows flagged isDemo). */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const ts = await db.tournament.findMany({ where: { isDemo: true }, select: { id: true, organiserId: true, venueId: true } });
  const ids = ts.map((t) => t.id);
  await db.$transaction(async (tx) => {
    await tx.match.deleteMany({ where: { tournamentId: { in: ids } } });
    await tx.matchRound.deleteMany({ where: { tournamentId: { in: ids } } });
    const regs = await tx.registration.findMany({ where: { tournamentId: { in: ids } }, select: { id: true } });
    const regIds = regs.map((r) => r.id);
    const payments = await tx.payment.findMany({ where: { registrationId: { in: regIds } }, select: { id: true } });
    await tx.refund.deleteMany({ where: { paymentId: { in: payments.map((p) => p.id) } } });
    await tx.payment.deleteMany({ where: { id: { in: payments.map((p) => p.id) } } });
    await tx.ticket.deleteMany({ where: { registrationId: { in: regIds } } });
    await tx.participant.deleteMany({ where: { registrationId: { in: regIds } } });
    await tx.teamMember.deleteMany({ where: { team: { tournamentId: { in: ids } } } });
    await tx.registration.deleteMany({ where: { id: { in: regIds } } });
    await tx.team.deleteMany({ where: { tournamentId: { in: ids } } });
    await tx.emailLog.deleteMany({ where: { tournamentId: { in: ids } } });
    await tx.tournament.deleteMany({ where: { id: { in: ids } } });
    await tx.organiser.deleteMany({ where: { id: { in: ts.map((t) => t.organiserId).filter(Boolean) as string[] }, tournaments: { none: {} } } });
    await tx.venue.deleteMany({ where: { id: { in: ts.map((t) => t.venueId).filter(Boolean) as string[] }, tournaments: { none: {} } } });
    await tx.user.deleteMany({ where: { isDemo: true, registrations: { none: {} } } });
  }, { timeout: 60_000 });
  console.log(`✔ Removed ${ids.length} demo tournaments and demo users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
