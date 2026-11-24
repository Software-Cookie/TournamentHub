/**
 * Sport & competition registry.
 *
 * Adding a sport = adding an entry here and running `npm run db:seed`.
 * Categories are copied into each tournament as TournamentCategory rows, so every
 * tournament can still customise fees, caps, rosters, age rules, etc.
 * Listing fees here are only the initial defaults — the platform admin edits live prices in /admin/sports.
 */
import type { GenderRule, ParticipantType } from "@prisma/client";

export type CategoryPreset = {
  code: string;
  name: string;
  participantType: ParticipantType;
  /** maximum players per entry (squad size) */
  teamSize: number;
  /** minimum players for team sports; defaults to teamSize */
  minTeamSize?: number;
  genderRule: GenderRule;
};

export type SportDefinition = {
  slug: string;
  name: string;
  /** default listing fee in paise */
  listingFee: number;
  scoring: { hint: string; placeholder: string };
  /** what one entry is called */
  entryNoun: { one: string; many: string };
  categories: CategoryPreset[];
};

const S = (code: string, name: string, genderRule: GenderRule): CategoryPreset => ({ code, name, participantType: "INDIVIDUAL", teamSize: 1, genderRule });
const D = (code: string, name: string, genderRule: GenderRule): CategoryPreset => ({ code, name, participantType: "TEAM", teamSize: 2, genderRule });
const T = (code: string, name: string, min: number, max: number, genderRule: GenderRule = "OPEN"): CategoryPreset => ({ code, name, participantType: "TEAM", teamSize: max, minTeamSize: min, genderRule });

const RACKET = (prefix = ""): CategoryPreset[] => [
  S(`${prefix}MS`, "Men's Singles", "MALE"),
  S(`${prefix}WS`, "Women's Singles", "FEMALE"),
  D(`${prefix}MD`, "Men's Doubles", "MALE"),
  D(`${prefix}WD`, "Women's Doubles", "FEMALE"),
  D(`${prefix}XD`, "Mixed Doubles", "MIXED"),
];

export const SPORTS: SportDefinition[] = [
  { slug: "badminton", name: "Badminton", listingFee: 49900, scoring: { hint: "Games separated by commas", placeholder: "21-18, 19-21, 21-15" }, entryNoun: { one: "entry", many: "entries" }, categories: RACKET() },
  {
    slug: "cricket",
    name: "Cricket",
    listingFee: 149900,
    scoring: { hint: "Runs/wickets for both sides", placeholder: "152/6 (20) vs 148/9 (20)" },
    entryNoun: { one: "team", many: "teams" },
    categories: [T("OPEN", "Open (11-a-side)", 11, 15), T("BOX", "Box cricket (8-a-side)", 8, 10), T("TB", "Tennis-ball (7-a-side)", 7, 9)],
  },
  {
    slug: "football",
    name: "Football",
    listingFee: 99900,
    scoring: { hint: "Goals (add penalties if any)", placeholder: "2-1 (pens 4-3)" },
    entryNoun: { one: "team", many: "teams" },
    categories: [T("11S", "11-a-side", 11, 16), T("7S", "7-a-side", 7, 10), T("5S", "5-a-side", 5, 8)],
  },
  { slug: "tennis", name: "Tennis", listingFee: 59900, scoring: { hint: "Sets", placeholder: "6-4, 3-6, 7-5" }, entryNoun: { one: "entry", many: "entries" }, categories: RACKET() },
  {
    slug: "volleyball",
    name: "Volleyball",
    listingFee: 79900,
    scoring: { hint: "Sets", placeholder: "25-20, 22-25, 15-12" },
    entryNoun: { one: "team", many: "teams" },
    categories: [T("M6", "Men's 6-a-side", 6, 9, "MALE"), T("W6", "Women's 6-a-side", 6, 9, "FEMALE"), T("X6", "Mixed 6-a-side", 6, 9, "MIXED")],
  },
  {
    slug: "basketball",
    name: "Basketball",
    listingFee: 79900,
    scoring: { hint: "Final points", placeholder: "68-61" },
    entryNoun: { one: "team", many: "teams" },
    categories: [T("M5", "Men's 5-a-side", 5, 10, "MALE"), T("W5", "Women's 5-a-side", 5, 10, "FEMALE"), T("3X3", "3x3", 3, 4)],
  },
  {
    slug: "table-tennis",
    name: "Table Tennis",
    listingFee: 39900,
    scoring: { hint: "Games", placeholder: "11-8, 9-11, 11-6, 11-4" },
    entryNoun: { one: "entry", many: "entries" },
    categories: [S("MS", "Men's Singles", "MALE"), S("WS", "Women's Singles", "FEMALE"), D("MD", "Men's Doubles", "MALE"), D("XD", "Mixed Doubles", "MIXED")],
  },
  {
    slug: "pickleball",
    name: "Pickleball",
    listingFee: 49900,
    scoring: { hint: "Games", placeholder: "11-7, 9-11, 11-9" },
    entryNoun: { one: "entry", many: "entries" },
    categories: [S("OS", "Open Singles", "OPEN"), D("MD", "Men's Doubles", "MALE"), D("WD", "Women's Doubles", "FEMALE"), D("XD", "Mixed Doubles", "MIXED")],
  },
  {
    slug: "kabaddi",
    name: "Kabaddi",
    listingFee: 79900,
    scoring: { hint: "Points", placeholder: "38-31" },
    entryNoun: { one: "team", many: "teams" },
    categories: [T("M7", "Men's (7-a-side)", 7, 12, "MALE"), T("W7", "Women's (7-a-side)", 7, 12, "FEMALE")],
  },
  {
    slug: "chess",
    name: "Chess",
    listingFee: 29900,
    scoring: { hint: "Result (1-0, 0-1, ½-½ + tiebreak)", placeholder: "1-0" },
    entryNoun: { one: "player", many: "players" },
    categories: [S("OPEN", "Open", "OPEN"), S("WOMEN", "Women's", "FEMALE")],
  },
  {
    slug: "other",
    name: "Other sport",
    listingFee: 49900,
    scoring: { hint: "Final result", placeholder: "3-1" },
    entryNoun: { one: "entry", many: "entries" },
    categories: [S("IND", "Individual (open)", "OPEN"), T("TEAM", "Team (open)", 2, 8)],
  },
];

export function getSportDef(slug: string) {
  return SPORTS.find((s) => s.slug === slug);
}

export const GENDER_RULE_LABEL: Record<GenderRule, string> = {
  OPEN: "Open to all",
  MALE: "Men only",
  FEMALE: "Women only",
  MIXED: "Mixed (men & women)",
};

/** Contact details are mandatory for every player in singles/doubles, and for the captain only in larger squads. */
export function requiresFullDetails(teamSize: number, index: number) {
  return teamSize <= 2 || index === 0;
}
