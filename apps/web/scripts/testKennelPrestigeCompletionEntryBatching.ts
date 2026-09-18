import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  deduplicateGrandChampionCompletionPairs,
  getGrandChampionCompletionPairs,
} from "@/server/services/kennelPrestige.service";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

const kennelPrestigeService = source(
  "apps/web/server/services/kennelPrestige.service.ts"
);

const requestedPairs = getGrandChampionCompletionPairs([
  { id: "dog-one", titleProgress: { grandCompletedAtShowDayId: "day-one" } },
  { id: "dog-two", titleProgress: { grandCompletedAtShowDayId: "day-one" } },
  { id: "dog-one", titleProgress: { grandCompletedAtShowDayId: "day-one" } },
  { id: "dog-three", titleProgress: { grandCompletedAtShowDayId: "day-two" } },
  { id: "dog-four", titleProgress: { grandCompletedAtShowDayId: null } },
  { id: "dog-five", titleProgress: null },
]);

assert.deepEqual(requestedPairs, [
  { dogId: "dog-one", showDayId: "day-one" },
  { dogId: "dog-two", showDayId: "day-one" },
  { dogId: "dog-one", showDayId: "day-one" },
  { dogId: "dog-three", showDayId: "day-two" },
]);

assert.deepEqual(deduplicateGrandChampionCompletionPairs(requestedPairs), [
  { dogId: "dog-one", showDayId: "day-one" },
  { dogId: "dog-two", showDayId: "day-one" },
  { dogId: "dog-three", showDayId: "day-two" },
]);

assert.match(
  kennelPrestigeService,
  /GRAND_CHAMPION_COMPLETION_ENTRY_PAIR_BATCH_SIZE = 200/,
  "completion-entry reads use a conservative fixed batch size"
);
assert.match(
  kennelPrestigeService,
  /for \([\s\S]*index < completionPairs\.length[\s\S]*await db\.showEntry\.findMany/,
  "completion-entry batches are awaited sequentially"
);
assert.match(
  kennelPrestigeService,
  /where: \{\s*OR: pairBatch,/,
  "each read uses exact dog/show-day pair predicates"
);
assert.doesNotMatch(
  kennelPrestigeService,
  /grandChampionCompletionShowDayIds/,
  "the prior independent completion-day predicate is removed"
);
assert.match(
  kennelPrestigeService,
  /requestedExactPairCount:[\s\S]*deduplicatedExactPairCount:[\s\S]*batchCount:[\s\S]*rowsReturned:[\s\S]*elapsedMs:/,
  "the lookup emits bounded-read performance measurements without IDs"
);

console.log("Kennel prestige completion-entry batching tests passed.");
