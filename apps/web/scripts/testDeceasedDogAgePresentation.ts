import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(join("apps", "web")) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function displayedAgeHours(args: {
  birthEpoch: number;
  currentEpoch: number;
  deathEpoch: number | null;
  lifecycleState: string;
}): number {
  const effectiveAgeEpoch =
    args.lifecycleState === "DECEASED" && args.deathEpoch !== null
      ? args.deathEpoch
      : args.currentEpoch;

  return Math.max(0, effectiveAgeEpoch - args.birthEpoch);
}

const dogService = source("apps/web/server/services/dog.service.ts");
const dogShowEntryPlanner = source(
  "apps/web/server/services/dogShowEntryPlanner.service.ts"
);

for (const [name, readModel] of [
  ["Dog Profile", dogService],
  ["Dog Show Entry planner", dogShowEntryPlanner],
] as const) {
  assert.match(
    readModel,
    /deathEpoch:\s*true/,
    `${name} selects the persisted death epoch for presentation`
  );
  assert.match(
    readModel,
    /lifecycleState === (?:DogLifecycleState\.)?"?DECEASED"?[\s\S]{0,100}deathEpoch !== null/,
    `${name} uses death epoch only for a deceased dog with a value`
  );
  assert.match(
    readModel,
    /const displayAgeHours = Math\.max\(/,
    `${name} keeps the cutoff calculation local to its read model`
  );
}

assert.match(
  dogService,
  /ageHours: displayAgeHours,[\s\S]{0,80}ageLabel: formatAgeLabel\(displayAgeHours\)/,
  "Dog Profile maps only its presentation age through the death cutoff"
);
assert.match(
  dogShowEntryPlanner,
  /ageHours: displayAgeHours/,
  "Dog Show Entry planner maps its display DTO through the death cutoff"
);
assert.match(
  dogService,
  /const ageHours = Math\.max\(0, currentEpoch - dog\.birthEpoch\);/,
  "Dog Profile retains its existing current-epoch calculation for non-presentation behavior"
);
assert.match(
  dogShowEntryPlanner,
  /broadCanShow: canEnterShows\(\s*currentEpoch,\s*dog\.birthEpoch/,
  "show-entry eligibility retains current-epoch semantics"
);

assert.equal(
  displayedAgeHours({
    birthEpoch: 100,
    currentEpoch: 900,
    deathEpoch: null,
    lifecycleState: "ALIVE",
  }),
  800,
  "living dogs continue aging at the current epoch"
);
assert.equal(
  displayedAgeHours({
    birthEpoch: 100,
    currentEpoch: 900,
    deathEpoch: 500,
    lifecycleState: "DECEASED",
  }),
  400,
  "deceased dogs stop aging at their death epoch"
);
assert.equal(
  displayedAgeHours({
    birthEpoch: 100,
    currentEpoch: 900,
    deathEpoch: null,
    lifecycleState: "DECEASED",
  }),
  800,
  "legacy deceased records without death epoch retain the current-epoch fallback"
);

console.log("Deceased dog age presentation checks passed.");
