import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  compareKennelRosterHealth,
  type RosterHealthPresentation,
} from "../components/kennel/kennelRosterHealth";

const root = process.cwd().endsWith(join("apps", "web"))
  ? resolve(process.cwd(), "..", "..")
  : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

const panel = source("apps/web/components/kennel/KennelDogsPanel.tsx");
const rosterRoute = source("apps/web/app/api/dogs/mine/route.ts");
const dogService = source("apps/web/server/services/dog.service.ts");
const brucellosisPresentation = source(
  "apps/web/server/services/brucellosisPresentation.service.ts"
);

for (const column of ["hips", "elbows", "cardiac", "thyroid", "caerEye", "brucellosis"]) {
  assert.match(panel, new RegExp(`id: "${column}"`), `${column} is an optional roster column`);
  assert.match(panel, new RegExp(`"${column}",`), `${column} is accepted by persisted roster preferences`);
}
assert.match(panel, /OPTIONAL_COLUMN_IDS\.includes/, "invalid saved visible columns remain rejected");
assert.match(panel, /SORT_KEYS\.includes/, "invalid saved sort keys remain rejected");
assert.match(panel, /case "healthStatus"/, "aggregate Health Tests column remains available");
assert.match(rosterRoute, /buildRosterPhenotypeHealthPresentation/, "roster maps existing phenotype records into safe presentation");
assert.match(rosterRoute, /db\.infectiousDiseaseTestRecord\.findMany/, "Brucellosis tests use a bounded set query");
assert.match(rosterRoute, /db\.dogInfectiousDiseaseStatus\.findMany/, "Brucellosis statuses use a bounded set query");
assert.doesNotMatch(rosterRoute.slice(rosterRoute.indexOf('const payload = await perf.measure("dtoMappingMs"')), /geneticLiability:|traitHead:|genotype:/, "roster health DTO excludes hidden health and genetic fields");
assert.match(dogService, /buildBrucellosisBreedingSafetyScreening/, "Dog Profile reuses the shared Brucellosis presentation helper");
assert.match(rosterRoute, /buildBrucellosisBreedingSafetyScreening/, "roster reuses the shared Brucellosis presentation helper");
assert.match(brucellosisPresentation, /isInfected\s*\?\s*null/, "infection overrides otherwise-valid negative records");
assert.match(brucellosisPresentation, /Positive - not cleared for breeding/, "shared helper preserves canonical positive wording");
assert.match(brucellosisPresentation, /return formatUtcDateTime\(epoch\)/, "shared helper preserves Dog Profile game-date formatting");

function phenotype(resultCode: string | null) {
  return {
    resultCode,
    resultLabel: resultCode,
    severity: resultCode ? "green" as const : null,
    state: resultCode ? "TESTED" as const : "UNTESTED" as const,
    availabilityLabel: null,
  };
}

function health(args: { hips?: string | null; brucellosis?: Partial<RosterHealthPresentation["brucellosis"]> }): RosterHealthPresentation {
  return {
    hips: phenotype(args.hips ?? "EXCELLENT"),
    elbows: phenotype("NORMAL"),
    cardiac: phenotype("NORMAL"),
    thyroid: phenotype("NORMAL"),
    caerEye: phenotype("NORMAL"),
    brucellosis: {
      currentStatusLabel: "Not screened",
      isCurrentNegative: false,
      isPositiveOrInfected: false,
      testedAtEpoch: null,
      ...args.brucellosis,
    },
  };
}

function compare(args: {
  aHealth: RosterHealthPresentation;
  bHealth: RosterHealthPresentation;
  column: keyof RosterHealthPresentation;
  direction: "asc" | "desc";
  aAge?: number;
  bAge?: number;
  aName?: string;
  bName?: string;
}) {
  return compareKennelRosterHealth({
    a: { health: args.aHealth, ageHours: args.aAge ?? 10, displayName: args.aName ?? "Bravo" },
    b: { health: args.bHealth, ageHours: args.bAge ?? 20, displayName: args.bName ?? "Alpha" },
    column: args.column,
    direction: args.direction,
  });
}

for (const [column, best, worst] of [
  ["hips", "EXCELLENT", "SEVERE"],
  ["elbows", "NORMAL", "GRADE_3"],
  ["cardiac", "NORMAL", "ABNORMAL"],
  ["thyroid", "NORMAL", "REDUCED_THYROID_FUNCTION"],
  ["caerEye", "NORMAL", "NOT_CLEARED"],
] as const) {
  const a = health({ hips: "EXCELLENT" });
  const b = health({ hips: "EXCELLENT" });
  a[column].resultCode = best;
  b[column].resultCode = worst;
  assert.ok(compare({ aHealth: a, bHealth: b, column, direction: "asc" }) < 0, `${column} ascending puts best result first`);
  assert.ok(compare({ aHealth: a, bHealth: b, column, direction: "desc" }) > 0, `${column} descending puts worst result first`);
}

for (const [column, order] of [
  ["hips", ["EXCELLENT", "GOOD", "FAIR", "BORDERLINE", "MILD", "MODERATE", "SEVERE"]],
  ["elbows", ["NORMAL", "BORDERLINE", "GRADE_1", "GRADE_2", "GRADE_3"]],
  ["cardiac", ["NORMAL", "EQUIVOCAL", "ABNORMAL"]],
  ["thyroid", ["NORMAL", "EQUIVOCAL", "AUTOIMMUNE_THYROIDITIS", "REDUCED_THYROID_FUNCTION"]],
  ["caerEye", ["NORMAL", "BREEDER_OPTION", "NOT_CLEARED"]],
] as const) {
  for (let index = 0; index < order.length - 1; index += 1) {
    const a = health({});
    const b = health({});
    a[column].resultCode = order[index];
    b[column].resultCode = order[index + 1];
    assert.ok(compare({ aHealth: a, bHealth: b, column, direction: "asc" }) < 0, `${column} preserves exact ascending rank order`);
  }
}

const sameResult = health({ hips: "GOOD" });
assert.ok(compare({ aHealth: sameResult, bHealth: sameResult, column: "hips", direction: "asc", aAge: 10, bAge: 20 }) < 0, "ascending ties put younger dogs first");
assert.ok(compare({ aHealth: sameResult, bHealth: sameResult, column: "hips", direction: "desc", aAge: 10, bAge: 20 }) > 0, "descending ties put older dogs first");
assert.ok(compare({ aHealth: sameResult, bHealth: sameResult, column: "hips", direction: "desc", aAge: 10, bAge: 10, aName: "Bravo", bName: "Alpha" }) > 0, "name tie-break remains ascending in descending sort");

const currentNegative = health({ brucellosis: { isCurrentNegative: true, testedAtEpoch: 5 } });
const expiredNegative = health({ brucellosis: { testedAtEpoch: 5 } });
const untested = health({});
const positive = health({ brucellosis: { isPositiveOrInfected: true, testedAtEpoch: 5 } });
assert.ok(compare({ aHealth: currentNegative, bHealth: expiredNegative, column: "brucellosis", direction: "asc" }) < 0, "current negative ranks before expired negative");
assert.ok(compare({ aHealth: expiredNegative, bHealth: untested, column: "brucellosis", direction: "asc" }) < 0, "expired negative ranks before untested");
assert.ok(compare({ aHealth: untested, bHealth: positive, column: "brucellosis", direction: "asc" }) < 0, "untested ranks before positive or infected");

console.log("Kennel roster health column checks passed.");
