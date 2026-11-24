/**
 * Pure single-elimination bracket engine (no DB access — unit-testable).
 */

export type BracketEntry = { id: string; seed?: number | null };

export type PlannedMatch = {
  round: number; // 1-based
  position: number; // 0-based within round
  entryAId: string | null;
  entryBId: string | null;
  isBye: boolean;
  winnerId: string | null; // pre-filled for BYE matches
  nextRound: number | null;
  nextPosition: number | null;
  nextSlot: "A" | "B" | null;
  isThirdPlace: boolean;
  loserNextSlot: "A" | "B" | null; // semi-final losers → third-place match
};

export type PlannedRound = { number: number; name: string; isThirdPlace: boolean; matchCount: number };

export function nextPowerOfTwo(n: number) {
  let s = 2;
  while (s < n) s *= 2;
  return s;
}

export function roundName(matchesInRound: number) {
  if (matchesInRound === 1) return "Final";
  if (matchesInRound === 2) return "Semi-finals";
  if (matchesInRound === 4) return "Quarter-finals";
  return `Round of ${matchesInRound * 2}`;
}

/**
 * Standard tournament seeding order for a bracket of `size` slots.
 * Returns rank numbers (1-based) per slot, e.g. size 8 → [1,8,4,5,2,7,3,6].
 * Guarantees seeds 1 and 2 can only meet in the final, and BYEs (ranks > N) go to top seeds.
 */
export function seedingOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((r) => [r, n + 1 - r]);
  }
  return order;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export type DrawMode = "SEEDED" | "RANDOM" | "SEQUENTIAL";

/**
 * Produce first-round pairs.
 *  - SEEDED: seeded entries take their seed rank, others fill remaining ranks (random), standard placement.
 *  - RANDOM: random draw, BYEs evenly spread.
 *  - SEQUENTIAL: entries in the given order (1 v 2, 3 v 4 …), BYEs evenly spread.
 */
export function firstRoundPairs(entries: BracketEntry[], mode: DrawMode, rand: () => number = Math.random): [string | null, string | null][] {
  const n = entries.length;
  if (n < 2) throw new Error("At least 2 confirmed entries are needed to generate fixtures.");
  const size = nextPowerOfTwo(n);
  const matchCount = size / 2;
  const byes = size - n;
  const order = seedingOrder(size);

  if (mode === "SEEDED") {
    const seeded = entries.filter((e) => e.seed != null).sort((a, b) => a.seed! - b.seed!);
    const unseeded = shuffle(entries.filter((e) => e.seed == null), rand);
    const ranked = [...seeded, ...unseeded]; // rank = index + 1
    const pairs: [string | null, string | null][] = [];
    for (let m = 0; m < matchCount; m++) {
      const ra = order[2 * m]!;
      const rb = order[2 * m + 1]!;
      pairs.push([ranked[ra - 1]?.id ?? null, ranked[rb - 1]?.id ?? null]);
    }
    return pairs;
  }

  // Which matches receive a BYE: those whose top-seed rank ≤ number of byes (spreads them evenly).
  const byeMatch = new Set<number>();
  for (let m = 0; m < matchCount; m++) if (order[2 * m]! <= byes) byeMatch.add(m);
  const list = mode === "RANDOM" ? shuffle(entries, rand) : entries;
  const pairs: [string | null, string | null][] = [];
  let i = 0;
  for (let m = 0; m < matchCount; m++) {
    if (byeMatch.has(m)) pairs.push([list[i++]!.id, null]);
    else {
      pairs.push([list[i]!.id, list[i + 1]!.id]);
      i += 2;
    }
  }
  return pairs;
}

/** Build the full bracket skeleton from first-round pairs. */
export function planBracket(pairs: [string | null, string | null][], opts: { thirdPlace: boolean }) {
  const size = pairs.length * 2;
  const totalRounds = Math.log2(size);
  if (!Number.isInteger(totalRounds)) throw new Error("First round must have a power-of-two number of slots.");

  const rounds: PlannedRound[] = [];
  const matches: PlannedMatch[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const count = size / 2 ** r;
    rounds.push({ number: r, name: roundName(count), isThirdPlace: false, matchCount: count });
    for (let p = 0; p < count; p++) {
      const isFinal = r === totalRounds;
      const isSemi = r === totalRounds - 1;
      matches.push({
        round: r,
        position: p,
        entryAId: null,
        entryBId: null,
        isBye: false,
        winnerId: null,
        nextRound: isFinal ? null : r + 1,
        nextPosition: isFinal ? null : Math.floor(p / 2),
        nextSlot: isFinal ? null : p % 2 === 0 ? "A" : "B",
        isThirdPlace: false,
        loserNextSlot: opts.thirdPlace && isSemi && totalRounds >= 2 ? (p % 2 === 0 ? "A" : "B") : null,
      });
    }
  }
  // A third-place playoff needs two real semi-final losers; with 3 entries one semi is a BYE, so skip it.
  const semiHasBye = totalRounds === 2 && pairs.some(([a, b]) => !a || !b);
  const withThird = opts.thirdPlace && totalRounds >= 2 && !semiHasBye;
  if (!withThird) for (const m of matches) m.loserNextSlot = null;
  if (withThird) {
    rounds.push({ number: totalRounds, name: "Third-place playoff", isThirdPlace: true, matchCount: 1 });
    matches.push({ round: totalRounds, position: 0, entryAId: null, entryBId: null, isBye: false, winnerId: null, nextRound: null, nextPosition: null, nextSlot: null, isThirdPlace: true, loserNextSlot: null });
  }

  // Fill round 1 and resolve BYEs.
  const get = (r: number, p: number, third = false) => matches.find((m) => m.round === r && m.position === p && m.isThirdPlace === third)!;
  pairs.forEach(([a, b], p) => {
    const m = get(1, p);
    m.entryAId = a;
    m.entryBId = b;
    if ((a && !b) || (!a && b)) {
      m.isBye = true;
      m.winnerId = a ?? b;
    }
    if (!a && !b) throw new Error("Invalid draw: a first-round match has no entries.");
  });
  for (const m of matches.filter((x) => x.round === 1 && x.isBye)) {
    if (m.nextRound == null) continue;
    const next = get(m.nextRound, m.nextPosition!);
    if (m.nextSlot === "A") next.entryAId = m.winnerId;
    else next.entryBId = m.winnerId;
  }
  return { rounds, matches, totalRounds, size, byes: pairs.filter(([a, b]) => !a || !b).length };
}
