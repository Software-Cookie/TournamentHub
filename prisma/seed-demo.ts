/**
 * SAMPLE DATA for local development & demos only.
 * Everything created here is flagged `isDemo = true` and can be removed with `npm run demo:clear`.
 * Refuses to run when NODE_ENV=production unless --allow-production is passed explicitly.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { SPORTS } from "../src/lib/sports";
import { firstRoundPairs, planBracket } from "../src/lib/bracket";

const db = new PrismaClient();
const IST = "+05:30";
const day = 864e5;
const code = (n = 6) => crypto.randomBytes(8).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, n).padEnd(n, "X");
const at = (date: string, time = "00:00") => new Date(`${date}T${time}:00${IST}`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

const MEN = ["Arjun Reddy", "Karthik Rao", "Vikram Nair", "Rohan Mehta", "Siddharth Iyer", "Aditya Varma", "Pranav Kulkarni", "Nikhil Sharma", "Rahul Menon", "Varun Pillai", "Harsha Vardhan", "Sai Teja", "Manoj Kumar", "Kiran Babu", "Abhinav Das", "Tarun Joshi"];
const WOMEN = ["Ananya Rao", "Sneha Reddy", "Priya Nair", "Kavya Menon", "Divya Iyer", "Meera Kulkarni", "Lakshmi Varma", "Pooja Sharma", "Shreya Das", "Nandini Pillai", "Aishwarya Joshi", "Ritika Babu"];

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
    throw new Error("Refusing to seed demo data in production.");
  }
  const existing = await db.tournament.count({ where: { isDemo: true } });
  if (existing) {
    console.log(`Demo data already present (${existing} tournaments). Run \`npm run demo:clear\` first to recreate.`);
    return;
  }
  const badminton = await db.sport.findUniqueOrThrow({ where: { slug: "badminton" } });
  const org = await db.organisation.findUniqueOrThrow({ where: { slug: "tournamenthub" } });
  const presets = SPORTS.find((s) => s.slug === "badminton")!.categories;
  const pw = await bcrypt.hash("DemoPlayer123", 10);

  // Demo players (can sign in with password DemoPlayer123)
  const people = [...MEN.map((n) => ({ n, g: "MALE" as const })), ...WOMEN.map((n) => ({ n, g: "FEMALE" as const }))];
  const users = [];
  for (const [i, p] of people.entries()) {
    const email = `${p.n.toLowerCase().replace(/\s+/g, ".")}@demo.tournamenthub.test`;
    users.push({
      ...p,
      email,
      phone: `98${String(48000000 + i * 7919).padStart(8, "0")}`,
      dob: `${1988 + (i % 15)}-0${(i % 9) + 1}-1${i % 9}`,
      user: await db.user.upsert({
        where: { email },
        create: { email, name: p.n, passwordHash: pw, emailVerified: new Date(), isDemo: true, city: "Hyderabad" },
        update: {},
      }),
    });
  }
  const men = users.filter((u) => u.g === "MALE");
  const women = users.filter((u) => u.g === "FEMALE");

  const organiser = await db.organiser.create({
    data: { organisationId: org.id, name: "Deccan Shuttlers Association", email: "events@deccanshuttlers.example", phone: "+91 90000 12345" },
  });
  const venues = await Promise.all([
    db.venue.create({ data: { organisationId: org.id, name: "Gachibowli Indoor Stadium", addressLine: "Gachibowli, Serilingampally", city: "Hyderabad", state: "Telangana", postalCode: "500032", latitude: 17.4474, longitude: 78.3489 } }),
    db.venue.create({ data: { organisationId: org.id, name: "Koramangala Indoor Courts", addressLine: "80 Feet Road, Koramangala 4th Block", city: "Bengaluru", state: "Karnataka", postalCode: "560034" } }),
    db.venue.create({ data: { organisationId: org.id, name: "Nehru Indoor Stadium", addressLine: "Periyamet", city: "Chennai", state: "Tamil Nadu", postalCode: "600003", latitude: 13.0839, longitude: 80.2707 } }),
    db.venue.create({ data: { organisationId: org.id, name: "Balewadi Sports Complex", addressLine: "Mhalunge, Balewadi", city: "Pune", state: "Maharashtra", postalCode: "411045" } }),
  ]);

  const now = Date.now();
  const defs = [
    { slug: "hyderabad-badminton-championship-2026", name: "Hyderabad Badminton Championship 2026", tagline: "The city's biggest open championship returns", start: new Date(now + 26 * day), close: new Date(now + 20 * day), venue: venues[0], fee: 80000, featured: true, cats: ["MS", "WS", "MD", "WD", "XD"], prizes: [[1, "CASH", "Champion – ₹25,000 + Trophy", 2500000], [2, "CASH", "Runner-up – ₹12,000", 1200000], [3, "RACKET", "Third place – Pro carbon racket", null]] as const, regCount: 6, status: "PUBLISHED" as const },
    { slug: "bengaluru-winter-smash-open", name: "Bengaluru Winter Smash Open", tagline: "Fast courts. Bigger rallies.", start: new Date(now + 45 * day), close: new Date(now + 38 * day), venue: venues[1], fee: 60000, featured: true, cats: ["MS", "MD", "XD"], prizes: [[1, "CASH", "Winners – ₹15,000", 1500000], [2, "TROPHY", "Runner-up trophy", null], [3, "SPORTS_KIT", "Sports kit", null]] as const, regCount: 3, status: "PUBLISHED" as const },
    { slug: "pune-corporate-doubles-cup", name: "Pune Corporate Doubles Cup", tagline: "Office rivals, on court", start: new Date(now - 1 * day), close: new Date(now - 5 * day), venue: venues[3], fee: 120000, featured: false, cats: ["MD", "XD"], prizes: [[1, "GIFT_VOUCHER", "₹10,000 gift voucher", 1000000], [2, "MEDAL", "Silver medals", null]] as const, regCount: 6, status: "ONGOING" as const },
    { slug: "chennai-shuttle-masters-2026", name: "Chennai Shuttle Masters 2026", tagline: "Season finale", start: new Date(now - 35 * day), close: new Date(now - 42 * day), venue: venues[2], fee: 50000, featured: false, cats: ["MS", "WS"], prizes: [[1, "CASH", "Champion – ₹20,000", 2000000], [2, "TROPHY", "Runner-up trophy", null], [3, "MEDAL", "Bronze medal", null]] as const, regCount: 8, status: "COMPLETED" as const },
  ];

  for (const d of defs) {
    const startDate = at(iso(d.start), "08:00");
    const t = await db.tournament.create({
      data: {
        slug: d.slug,
        name: d.name,
        tagline: d.tagline,
        isDemo: true,
        organisationId: org.id,
        sportId: badminton.id,
        organiserId: organiser.id,
        venueId: d.venue!.id,
        status: d.status,
        isFeatured: d.featured,
        description: `${d.name} brings together club players, rising juniors and seasoned veterans for a weekend of competitive badminton.\n\nMatches are played on synthetic BWF-approved mats with feather shuttles from the quarter-finals onwards. Every category follows a single-elimination format with seeded draws.`,
        startDate,
        endDate: new Date(startDate.getTime() + day),
        registrationOpensAt: new Date(Math.min(now, startDate.getTime()) - 30 * day),
        registrationClosesAt: d.close,
        matchStartTime: "08:00",
        entryFee: d.fee,
        maxParticipants: 160,
        rules: "• BWF laws of badminton apply.\n• Best of 3 games to 21 points (rally scoring).\n• Players must report 15 minutes before their match; a 10-minute grace period applies before a walkover is awarded.\n• Non-marking shoes are mandatory.\n• The referee's decision is final.",
        terms: "By registering you confirm that the information provided is accurate and that you are medically fit to participate. The organiser may use photographs taken at the event for promotion.",
        refundPolicy: "Full refund if you withdraw at least 7 days before the tournament. 50% refund up to 3 days before. No refunds after that, or for no-shows. Refunds are processed to the original payment method within 5–7 working days.",
        participantInstructions: "Please arrive at the tournament venue at least 15 minutes before your scheduled match. Report to the registration desk for verification. Carry your ticket and a valid identification document.",
        prizePoolValue: d.prizes.reduce((s, p) => s + (p[3] ?? 0), 0),
        createdAt: new Date(now - 40 * day),
      },
    });
    for (const [i, c] of presets.filter((p) => d.cats.includes(p.code)).entries()) {
      await db.tournamentCategory.create({
        data: { tournamentId: t.id, code: c.code, name: c.name, participantType: c.participantType, teamSize: c.teamSize, genderRule: c.genderRule, sortOrder: i, maxEntries: 32, entryFee: c.teamSize > 1 ? d.fee + 40000 : null, status: d.status === "PUBLISHED" ? "OPEN" : "CLOSED" },
      });
    }
    for (const [pos, type, title, cash] of d.prizes) {
      await db.prize.create({ data: { tournamentId: t.id, position: pos, type, title, cashValue: cash, quantity: 1 } });
    }
    await db.sponsor.createMany({ data: [{ tournamentId: t.id, name: "Smashline Sports" }, { tournamentId: t.id, name: "FeatherPro Shuttles" }] });

    // Registrations
    const cats = await db.tournamentCategory.findMany({ where: { tournamentId: t.id }, orderBy: { sortOrder: "asc" } });
    for (const cat of cats) {
      const pool = cat.genderRule === "FEMALE" ? women : men;
      const n = cat.teamSize === 1 ? d.regCount : Math.min(d.regCount, 6);
      for (let i = 0; i < n; i++) {
        const team =
          cat.teamSize === 1
            ? [pool[i % pool.length]!]
            : cat.genderRule === "MIXED"
              ? [men[(i * 2) % men.length]!, women[i % women.length]!]
              : [pool[(i * 2) % pool.length]!, pool[(i * 2 + 1) % pool.length]!];
        const owner = team[0]!;
        const amount = cat.entryFee ?? t.entryFee;
        const created = new Date(t.registrationOpensAt.getTime() + (i + 1) * 0.6 * day);
        const teamRow =
          cat.teamSize > 1
            ? await db.team.create({
                data: { tournamentId: t.id, categoryId: cat.id, name: `${owner.n.split(" ")[0]} & ${team[1]!.n.split(" ")[0]}`, captainName: owner.n, captainEmail: owner.email, captainPhone: owner.phone, activeKey: `${cat.id}:${owner.n.split(" ")[0]!.toLowerCase()} & ${team[1]!.n.split(" ")[0]!.toLowerCase()}` },
              })
            : null;
        const reg = await db.registration.create({
          data: {
            code: `${cat.code}-${code()}`,
            tournamentId: t.id,
            categoryId: cat.id,
            userId: owner.user.id,
            teamId: teamRow?.id,
            status: "CONFIRMED",
            amount,
            termsAcceptedAt: created,
            confirmedAt: created,
            createdAt: created,
            activeKey: `${cat.id}:${owner.user.id}`,
            seed: i < 2 ? i + 1 : null,
          },
        });
        for (const [slot, p] of team.entries()) {
          const part = await db.participant.create({
            data: { registrationId: reg.id, tournamentId: t.id, categoryId: cat.id, fullName: p.n, email: p.email, phone: p.phone, dateOfBirth: new Date(`${p.dob}T00:00:00Z`), gender: p.g, city: d.venue!.city, activeKey: `${cat.id}:${p.email}` },
          });
          if (teamRow) await db.teamMember.create({ data: { teamId: teamRow.id, participantId: part.id, slot: slot + 1, role: slot === 0 ? "CAPTAIN" : "PLAYER" } });
        }
        const fee = Math.round(amount * 0.0236);
        await db.payment.create({
          data: { registrationId: reg.id, tournamentId: t.id, userId: owner.user.id, providerOrderId: `demo_order_${code(12)}`, providerPaymentId: `demo_pay_${code(12)}`, amount, status: "PAID", method: i % 3 ? "upi" : "card", fee, tax: Math.round(fee * 0.18), paidAt: created, verifiedVia: "demo", createdAt: created },
        });
        await db.ticket.create({ data: { registrationId: reg.id, number: `TKT-2026-${code(7)}`, qrToken: crypto.randomBytes(24).toString("base64url"), issuedAt: created } });
      }
      // Brackets for ongoing/completed tournaments
      if (d.status !== "PUBLISHED") await demoBracket(t.id, cat.id, d.status === "COMPLETED" ? "all" : "round1", startDate);
    }
  }
  await seedOtherSports(org.id, organiser.id, users.map((u) => u.user.id));
  await db.tournament.updateMany({ where: { isDemo: true }, data: { listingStatus: "WAIVED" } });
  console.log("✔ Demo data created (7 tournaments across badminton, cricket, football & tennis). Demo player login: arjun.reddy@demo.tournamenthub.test / DemoPlayer123");
}

async function demoBracket(tournamentId: string, categoryId: string, play: "all" | "round1", start: Date) {
  const regs = await db.registration.findMany({ where: { categoryId, status: "CONFIRMED" }, orderBy: { createdAt: "asc" } });
  const plan = planBracket(firstRoundPairs(regs.map((r) => ({ id: r.id, seed: r.seed })), "SEEDED"), { thirdPlace: false });
  const roundIds: Record<number, string> = {};
  for (const r of plan.rounds) roundIds[r.number] = (await db.matchRound.create({ data: { tournamentId, categoryId, number: r.number, name: r.name, status: r.number === 1 ? "ACTIVE" : "PENDING" } })).id;
  const ids: Record<string, string> = {};
  for (const m of [...plan.matches].sort((a, b) => b.round - a.round)) {
    const row = await db.match.create({
      data: {
        tournamentId, categoryId, roundId: roundIds[m.round]!, position: m.position, entryAId: m.entryAId, entryBId: m.entryBId, isBye: m.isBye, winnerId: m.winnerId,
        status: m.isBye ? "COMPLETED" : m.entryAId && m.entryBId ? "UPCOMING" : "SCHEDULED",
        nextMatchId: m.nextRound ? ids[`${m.nextRound}:${m.nextPosition}`] : null, nextSlot: m.nextSlot,
        court: m.isBye ? null : `Court ${(m.position % 4) + 1}`,
        scheduledAt: m.isBye ? null : new Date(start.getTime() + ((m.round - 1) * 2 + (m.position % 2)) * 3600_000 * 0.75),
      },
    });
    ids[`${m.round}:${m.position}`] = row.id;
  }
  const scores = ["21-17, 21-15", "19-21, 21-18, 21-16", "21-12, 21-19", "21-23, 21-14, 21-19"];
  for (let r = 1; r <= plan.totalRounds; r++) {
    if (play === "round1" && r > 1) break;
    const matches = await db.match.findMany({ where: { categoryId, round: { number: r }, isBye: false }, orderBy: { position: "asc" } });
    for (const [i, m] of matches.entries()) {
      if (!m.entryAId || !m.entryBId) continue;
      if (play === "round1" && i === matches.length - 1) {
        await db.match.update({ where: { id: m.id }, data: { status: "ONGOING", startedAt: new Date(), liveScore: "21-18, 9-11" } });
        continue;
      }
      const winnerId = i % 3 === 2 ? m.entryBId : m.entryAId;
      await db.match.update({ where: { id: m.id }, data: { status: "COMPLETED", winnerId, completedAt: m.scheduledAt, startedAt: m.scheduledAt, liveScore: scores[i % 4] } });
      await db.matchResult.create({ data: { matchId: m.id, winnerId, score: scores[i % 4]!, durationMinutes: 35 + i * 4 } });
      if (m.nextMatchId) await db.match.update({ where: { id: m.nextMatchId }, data: m.nextSlot === "A" ? { entryAId: winnerId } : { entryBId: winnerId } });
    }
    await db.matchRound.updateMany({ where: { categoryId, number: r }, data: { status: play === "all" ? "COMPLETED" : "ACTIVE" } });
  }
  if (play === "all") {
    const final = await db.match.findFirst({ where: { categoryId, nextMatchId: null } });
    await db.tournamentCategory.update({ where: { id: categoryId }, data: { status: "COMPLETED", championId: final?.winnerId } });
    await db.tournament.update({ where: { id: tournamentId }, data: { resultsAnnouncedAt: new Date() } });
  } else {
    await db.tournamentCategory.update({ where: { id: categoryId }, data: { status: "IN_PROGRESS" } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

/** Team & racket sports so the demo shows squads, other scoring formats and the sport filters. */
async function seedOtherSports(orgId: string, organiserId: string, userIds: string[]) {
  const now = Date.now();
  const TEAMS = ["Charminar Chargers", "Golconda Giants", "Hitech Hawks", "Banjara Blasters", "Lakeside Lions", "Deccan Dynamos"];
  const defs = [
    { sport: "cricket", slug: "hyderabad-box-cricket-league", name: "Hyderabad Box Cricket League", tagline: "Eight overs. No mercy.", city: ["Lal Bahadur Stadium Nets", "Fateh Maidan", "Hyderabad"], fee: 300000, cat: "BOX", days: 18, prizes: [[1, "CASH", "Champions – ₹30,000 + trophy", 3000000], [2, "CASH", "Runners-up – ₹12,000", 1200000]] },
    { sport: "football", slug: "bengaluru-5-a-side-cup", name: "Bengaluru 5-a-side Cup", tagline: "Small pitch, big moments", city: ["Turf Park Arena", "HSR Layout, Sector 2", "Bengaluru"], fee: 250000, cat: "5S", days: 30, prizes: [[1, "CASH", "Winners – ₹20,000", 2000000], [2, "SPORTS_KIT", "Team kits for runners-up", null]] },
    { sport: "tennis", slug: "chennai-open-tennis-classic", name: "Chennai Open Tennis Classic", tagline: "Hard courts, hot rallies", city: ["SDAT Tennis Stadium", "Nungambakkam", "Chennai"], fee: 90000, cat: "MS", days: 40, prizes: [[1, "CASH", "Champion – ₹15,000", 1500000], [2, "TROPHY", "Runner-up trophy", null]] },
  ] as const;
  for (const d of defs) {
    const sport = await db.sport.findUniqueOrThrow({ where: { slug: d.sport } });
    const preset = SPORTS.find((x) => x.slug === d.sport)!;
    const venue = await db.venue.create({ data: { organisationId: orgId, name: d.city[0], addressLine: d.city[1], city: d.city[2] } });
    const start = new Date(new Date(now + d.days * day).toISOString().slice(0, 10) + "T07:30:00+05:30");
    const t = await db.tournament.create({
      data: {
        slug: d.slug, name: d.name, tagline: d.tagline, isDemo: true, organisationId: orgId, sportId: sport.id, organiserId, venueId: venue.id,
        status: "PUBLISHED", isFeatured: true, listingStatus: "WAIVED",
        description: `${d.name} is open to club and corporate ${preset.entryNoun.many}. Knockout format with seeded draws, live scores and prizes for the top finishers.`,
        startDate: start, registrationOpensAt: new Date(now - 10 * day), registrationClosesAt: new Date(start.getTime() - 4 * day), matchStartTime: "07:30",
        entryFee: d.fee, maxParticipants: 64,
        rules: "Standard rules of the sport apply. Teams must report 30 minutes before their first match. The referee's decision is final.",
        refundPolicy: "Full refund up to 7 days before the event; no refunds after that.",
        prizePoolValue: d.prizes.reduce((a, p) => a + (p[3] ?? 0), 0),
      },
    });
    for (const [i, c] of preset.categories.entries()) {
      await db.tournamentCategory.create({ data: { tournamentId: t.id, code: c.code, name: c.name, participantType: c.participantType, teamSize: c.teamSize, minTeamSize: c.minTeamSize ?? null, genderRule: c.genderRule, sortOrder: i, maxEntries: c.teamSize > 2 ? 16 : 32, status: "OPEN" } });
    }
    for (const [pos, type, title, cash] of d.prizes) await db.prize.create({ data: { tournamentId: t.id, position: pos, type, title, cashValue: cash } });
    const cat = await db.tournamentCategory.findFirstOrThrow({ where: { tournamentId: t.id, code: d.cat } });
    const entries = cat.teamSize > 2 ? 6 : 5;
    for (let i = 0; i < entries; i++) {
      const owner = userIds[(i * 3 + d.days) % userIds.length]!;
      const u = await db.user.findUniqueOrThrow({ where: { id: owner } });
      const created = new Date(now - (8 - i) * day);
      const isTeam = cat.teamSize > 2;
      const team = isTeam ? await db.team.create({ data: { tournamentId: t.id, categoryId: cat.id, name: TEAMS[i]!, captainName: u.name!, captainEmail: u.email, captainPhone: "9876500" + String(100 + i), activeKey: `${cat.id}:${TEAMS[i]!.toLowerCase()}` } }) : null;
      const existing = await db.registration.findFirst({ where: { categoryId: cat.id, userId: owner } });
      if (existing) continue;
      const reg = await db.registration.create({ data: { code: `${cat.code}-${code()}`, tournamentId: t.id, categoryId: cat.id, userId: owner, teamId: team?.id, status: "CONFIRMED", amount: d.fee, termsAcceptedAt: created, confirmedAt: created, createdAt: created, activeKey: `${cat.id}:${owner}` } });
      const size = isTeam ? (cat.minTeamSize ?? cat.teamSize) : 1;
      for (let p = 0; p < size; p++) {
        const part = await db.participant.create({
          data: p === 0
            ? { registrationId: reg.id, tournamentId: t.id, categoryId: cat.id, fullName: u.name!, email: u.email, phone: "9876500" + String(100 + i), dateOfBirth: new Date("1994-05-12T00:00:00Z"), gender: "MALE", city: d.city[2], activeKey: `${cat.id}:${u.email}` }
            : { registrationId: reg.id, tournamentId: t.id, categoryId: cat.id, fullName: `${TEAMS[i]!.split(" ")[0]} Player ${p + 1}`, gender: "MALE" },
        });
        if (team) await db.teamMember.create({ data: { teamId: team.id, participantId: part.id, slot: p + 1, role: p === 0 ? "CAPTAIN" : "PLAYER" } });
      }
      const fee = Math.round(d.fee * 0.0236);
      await db.payment.create({ data: { registrationId: reg.id, tournamentId: t.id, userId: owner, providerOrderId: `demo_order_${code(12)}`, providerPaymentId: `demo_pay_${code(12)}`, amount: d.fee, status: "PAID", method: "upi", fee, tax: Math.round(fee * 0.18), paidAt: created, verifiedVia: "demo", createdAt: created } });
      await db.ticket.create({ data: { registrationId: reg.id, number: `TKT-2026-${code(7)}`, qrToken: crypto.randomBytes(24).toString("base64url"), issuedAt: created } });
    }
  }
}
