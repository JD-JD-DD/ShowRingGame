import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  canReattributeExistingShowEntry,
  getDeterministicHandlerUsedByDogId,
} from "../server/services/showEntry.service";

function handlerUsed(dogIds: string[]): Record<string, boolean> {
  return Object.fromEntries(getDeterministicHandlerUsedByDogId(dogIds));
}

function assertAttribution(
  dogIds: string[],
  expected: Record<string, boolean>,
  label: string
) {
  assert.deepEqual(handlerUsed(dogIds), expected, label);
}

function expectedFor(dogIds: string[]): Record<string, boolean> {
  return Object.fromEntries(
    [...dogIds].sort((a, b) => a.localeCompare(b)).map((dogId, index) => [
      dogId,
      index >= 3,
    ])
  );
}

assertAttribution(["A", "B", "C"], { A: false, B: false, C: false }, "A: three dogs are owner handled");
assertAttribution(["D", "B", "A", "C"], { A: false, B: false, C: false, D: true }, "B: fourth deterministic dog is handler covered");
assertAttribution(["F", "E", "D", "C", "B", "A"], expectedFor(["A", "B", "C", "D", "E", "F"]), "C/D: exact handler-covered dogs use stable order");
assertAttribution(["G", "F", "E", "D", "C", "B", "A"], expectedFor(["A", "B", "C", "D", "E", "F", "G"]), "E: seven dogs retain the first three owner handled");
assertAttribution(["A1", "A2", "A3"], expectedFor(["A1", "A2", "A3"]), "F: Breed A stays independent");
assertAttribution(["B4", "B3", "B2", "B1"], expectedFor(["B1", "B2", "B3", "B4"]), "F: Breed B has its own handler-covered entry");
assertAttribution(["A4", "A3", "A2", "A1"], expectedFor(["A1", "A2", "A3", "A4"]), "G/H: each show-day group is independently attributable");

const finalFive = expectedFor(["A", "B", "C", "D", "E"]);
assert.deepEqual(handlerUsed(["E", "D", "C", "B", "A"]), finalFive, "I/J: incremental final population is deterministic");
assert.deepEqual(handlerUsed(["A", "B", "C", "D", "E", "F"]), expectedFor(["A", "B", "C", "D", "E", "F"]), "K: dogs four through six are handler covered");
assert.deepEqual(handlerUsed(["A", "B", "C", "D", "E", "F", "G"]), expectedFor(["A", "B", "C", "D", "E", "F", "G"]), "L: seventh dog adds one handler-covered entry");

const finalSix = expectedFor(["A", "B", "C", "D", "E", "F"]);
for (const batching of [
  ["A", "B", "C", "D", "E", "F"],
  ["A", "B", "C", "D", "E", "F"].reverse(),
  ["C", "A", "F", "B", "E", "D"],
]) {
  assert.deepEqual(handlerUsed(batching), finalSix, "M: request order cannot affect final attribution");
}

assert.equal(
  canReattributeExistingShowEntry({
    entryStatus: "ENTERED",
    showDayStatus: "ENTRY_OPEN",
    showDayPublishedAtEpoch: null,
    showDayResultCount: 0,
    showDayAwardCount: 0,
    entryHasResult: false,
    entryAwardCount: 0,
  }),
  true,
  "open entries without historical output are mutable"
);
assert.equal(
  canReattributeExistingShowEntry({
    entryStatus: "JUDGED",
    showDayStatus: "RESULTS_PUBLISHED",
    showDayPublishedAtEpoch: 1,
    showDayResultCount: 1,
    showDayAwardCount: 1,
    entryHasResult: true,
    entryAwardCount: 1,
  }),
  false,
  "historical entries are locked"
);

const source = readFileSync(
  join(process.cwd(), "server", "services", "showEntry.service.ts"),
  "utf8"
);
assert.ok(source.includes('code: "HANDLER_ATTRIBUTION_LOCKED"'));
assert.ok(source.includes("await tx.showEntry.update({"));
assert.ok(source.includes("handlerUsedByDogIdByGroupKey"));

console.log("Show-entry handler attribution checks passed.");
