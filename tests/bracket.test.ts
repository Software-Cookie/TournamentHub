import { test } from "node:test";
import assert from "node:assert/strict";
import { firstRoundPairs, planBracket, seedingOrder, nextPowerOfTwo, roundName } from "../src/lib/bracket";

const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}` }));

test("seeding order", () => {
  assert.deepEqual(seedingOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.equal(nextPowerOfTwo(5), 8);
  assert.equal(nextPowerOfTwo(2), 2);
});

test("round names", () => {
  assert.equal(roundName(1), "Final");
  assert.equal(roundName(2), "Semi-finals");
  assert.equal(roundName(4), "Quarter-finals");
  assert.equal(roundName(8), "Round of 16");
  assert.equal(roundName(32), "Round of 64");
});

test("16 entries sequential → 1v2, 3v4 …", () => {
  const pairs = firstRoundPairs(entries(16), "SEQUENTIAL");
  assert.equal(pairs.length, 8);
  assert.deepEqual(pairs[0], ["e1", "e2"]);
  assert.deepEqual(pairs[7], ["e15", "e16"]);
  const plan = planBracket(pairs, { thirdPlace: false });
  assert.equal(plan.totalRounds, 4);
  assert.deepEqual(plan.rounds.map((r) => r.name), ["Round of 16", "Quarter-finals", "Semi-finals", "Final"]);
  assert.equal(plan.matches.length, 15);
  assert.equal(plan.byes, 0);
});

for (const n of [2, 3, 5, 6, 7, 9, 12, 13, 17, 33, 64]) {
  test(`${n} entries: every entry placed once, no double-BYE, byes advance`, () => {
    for (const mode of ["SEQUENTIAL", "RANDOM", "SEEDED"] as const) {
      const pairs = firstRoundPairs(entries(n), mode);
      const placed = pairs.flat().filter(Boolean);
      assert.equal(placed.length, n);
      assert.equal(new Set(placed).size, n);
      assert.ok(pairs.every(([a, b]) => a || b));
      const plan = planBracket(pairs, { thirdPlace: true });
      assert.equal(plan.byes, nextPowerOfTwo(n) - n);
      const r2 = plan.matches.filter((m) => m.round === 2 && !m.isThirdPlace);
      const advanced = r2.flatMap((m) => [m.entryAId, m.entryBId]).filter(Boolean);
      if (plan.totalRounds >= 2) assert.equal(advanced.length, plan.byes);
    }
  });
}

test("seeded: 1 and 2 on opposite halves, top seeds get byes", () => {
  const e = entries(6).map((x, i) => ({ ...x, seed: i < 2 ? i + 1 : null }));
  const pairs = firstRoundPairs(e, "SEEDED");
  assert.deepEqual(pairs[0], ["e1", null]);
  const idx2 = pairs.findIndex((p) => p.includes("e2"));
  assert.ok(idx2 >= pairs.length / 2);
  assert.equal(pairs[idx2]![1], null);
});

test("third place playoff wiring", () => {
  const plan = planBracket(firstRoundPairs(entries(8), "SEQUENTIAL"), { thirdPlace: true });
  const third = plan.matches.filter((m) => m.isThirdPlace);
  assert.equal(third.length, 1);
  const semis = plan.matches.filter((m) => m.round === 2 && !m.isThirdPlace);
  assert.deepEqual(semis.map((s) => s.loserNextSlot), ["A", "B"]);
  // 3 entries: semi has a bye → no playoff
  const p3 = planBracket(firstRoundPairs(entries(3), "SEQUENTIAL"), { thirdPlace: true });
  assert.equal(p3.matches.filter((m) => m.isThirdPlace).length, 0);
});
