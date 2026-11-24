/**
 * Production-safe reference data seed (idempotent). Creates sports and the platform organisation.
 * Live listing prices and the "active" switch are owned by the platform admin (/admin/sports),
 * so existing rows only get their name/config/order refreshed — prices are never overwritten.
 * Does NOT create users, tournaments or sample data — see prisma/seed-demo.ts for that.
 */
import { PrismaClient } from "@prisma/client";
import { SPORTS } from "../src/lib/sports";

const db = new PrismaClient();

async function main() {
  for (const [i, s] of SPORTS.entries()) {
    const config = { categories: s.categories, scoring: s.scoring, entryNoun: s.entryNoun };
    await db.sport.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, name: s.name, isActive: true, listingFee: s.listingFee, sortOrder: i, config },
      update: { name: s.name, sortOrder: i, config },
    });
  }
  await db.organisation.upsert({
    where: { slug: "tournamenthub" },
    create: { slug: "tournamenthub", name: "TournamentHub", plan: "INTERNAL" },
    update: {},
  });
  console.log(`✔ Seeded ${SPORTS.length} sports and the platform organisation.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
