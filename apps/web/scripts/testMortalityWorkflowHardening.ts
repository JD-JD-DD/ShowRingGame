import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAccidentIllnessEmergencySourceKey } from "../server/services/emergencyVetCare.service";
import { resolveInstantiatedAccidentCandidates } from "../server/services/lifecycle.service";

const root = process.cwd().endsWith(join("apps", "web"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

const lifecycle = source("apps/web/server/services/lifecycle.service.ts");
const schema = source("apps/web/prisma/schema.prisma");
const cron = source("apps/web/app/api/cron/resolve-dog-mortality/route.ts");

assert.match(
  lifecycle,
  /getAccidentIllnessEmergencySourceKey[\s\S]*sourceKey: \{ in: accidentSourceKeys \}/,
  "existing pending and terminal accident events are selected by their deterministic source key"
);
assert.match(
  lifecycle,
  /resolveInstantiatedAccidentCandidates[\s\S]*cause: "AGE"/,
  "a consumed surviving accident yields to the unchanged later age-death projection"
);
assert.match(
  lifecycle,
  /emergencyStatus === "TREATED_SURVIVED"[\s\S]*cause: "AGE"/,
  "a pending emergency event cannot be bypassed by generic mortality"
);
assert.match(
  lifecycle,
  /MORTALITY_SCAN_PAGE_SIZE = 250/,
  "mortality scans have an explicit bounded technical page size"
);
assert.match(
  lifecycle,
  /id: \{ gt: scanState\.cursorDogId \}[\s\S]*orderBy: \{ id: "asc" \}[\s\S]*take: MORTALITY_SCAN_PAGE_SIZE/,
  "mortality scans use stable keyset paging rather than a repeatedly fixed leading page"
);
assert.match(
  lifecycle,
  /cursorDogId: candidates\.length < MORTALITY_SCAN_PAGE_SIZE \? null : nextCursorDogId/,
  "the persisted scan cursor wraps after the final page so later dogs are eventually scanned"
);
assert.match(
  lifecycle,
  /MAX_DEATHS_PER_RESOLUTION = 3/,
  "the existing three-candidate resolution limit remains unchanged"
);
assert.match(
  lifecycle,
  /for \(const \{ dog, projected \} of dueDeaths\) \{[\s\S]*catch \(error\)/,
  "per-candidate failures are isolated and remain retryable on future scans"
);
assert.match(schema, /model MortalityScanState/, "scan progress is persisted safely across cron invocations");
assert.match(cron, /accidentCandidatesSkippedBecauseEventExists/, "cron logs accident exclusions");

const accidentCandidate = {
  dog: {
    id: "dog-with-event",
    regNumber: "SRG-000001",
    birthEpoch: 0,
  },
  projected: { deathEpoch: 10, cause: "ACCIDENT_ILLNESS" },
} as const;
const accidentKey = getAccidentIllnessEmergencySourceKey({
  dogId: accidentCandidate.dog.id,
  projectedDeathEpoch: accidentCandidate.projected.deathEpoch,
});

assert.deepEqual(
  resolveInstantiatedAccidentCandidates(
    [accidentCandidate] as any,
    new Map([[accidentKey, "PENDING"]]),
    Number.MAX_SAFE_INTEGER
  ),
  { candidates: [], skippedAccidents: 1 },
  "a pending emergency event removes the corresponding generic accident candidate"
);
assert.equal(
  resolveInstantiatedAccidentCandidates(
    [accidentCandidate] as any,
    new Map(),
    Number.MAX_SAFE_INTEGER
  ).candidates.length,
  1,
  "a fresh accident candidate remains eligible to create its emergency event"
);
const agedAccidentCandidate = {
  ...accidentCandidate,
  dog: { ...accidentCandidate.dog, deathEpoch: 20 },
};
assert.deepEqual(
  resolveInstantiatedAccidentCandidates(
    [agedAccidentCandidate] as any,
    new Map([[accidentKey, "TREATED_SURVIVED"]]),
    20
  ),
  {
    candidates: [
      {
        dog: agedAccidentCandidate.dog,
        projected: { deathEpoch: 20, cause: "AGE" },
      },
    ],
    skippedAccidents: 1,
  },
  "a survived accident does not mask a later age death"
);
assert.deepEqual(
  resolveInstantiatedAccidentCandidates(
    [accidentCandidate] as any,
    new Map([[accidentKey, "CANCELED"]]),
    Number.MAX_SAFE_INTEGER
  ),
  { candidates: [], skippedAccidents: 1 },
  "a terminal emergency record never re-enters generic accident resolution"
);

console.log("Mortality workflow hardening checks passed.");
