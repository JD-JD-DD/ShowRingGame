import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getGrandChampionCompletionPrestigeForHandling,
  getGrandChampionMilestonePrestige,
  isGrandChampionPrestigeComplete,
} from "@/server/services/kennelPrestige.service";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

const showEntryService = source("apps/web/server/services/showEntry.service.ts");
const kennelPrestigeService = source(
  "apps/web/server/services/kennelPrestige.service.ts"
);

assert.equal(
  isGrandChampionPrestigeComplete({
    currentTitleCode: "CH",
    grandPoints: 25,
    grandMajorCount: 3,
    grandChampionDefeatShowCount: 3,
  }),
  false,
  "CH dogs with GCH totals are not complete GCH prestige dogs until promoted"
);

assert.equal(
  isGrandChampionPrestigeComplete({
    currentTitleCode: "GCH",
    grandPoints: 25,
    grandMajorCount: 3,
    grandChampionDefeatShowCount: 3,
  }),
  true,
  "base GCH completion qualifies for GCH prestige"
);

assert.equal(
  isGrandChampionPrestigeComplete({
    currentTitleCode: "GCH",
    grandPoints: 25,
    grandMajorCount: 2,
    grandChampionDefeatShowCount: 3,
  }),
  false,
  "base GCH prestige requires the GCH major requirement"
);

assert.equal(getGrandChampionCompletionPrestigeForHandling(false), 45);
assert.equal(getGrandChampionCompletionPrestigeForHandling(true), 30);
assert.equal(getGrandChampionCompletionPrestigeForHandling(null), 30);
assert.equal(getGrandChampionCompletionPrestigeForHandling(undefined), 30);

assert.ok(
  showEntryService.includes("const quote = buildBulkEntryQuote({"),
  "bulk entry creates one authoritative handler quote"
);
assert.ok(
  showEntryService.includes("totalRequired: quote.totalCost"),
  "affordability uses the authoritative quote total"
);
assert.ok(
  showEntryService.includes("data: { balance: balanceAfter }"),
  "kennel balance uses the same authoritative quote"
);
assert.ok(
  showEntryService.includes("amount: -quote.handlerFee"),
  "handler ledger rows use the exact quote handler fee"
);
assert.ok(
  showEntryService.includes("if (quote.handlerFee > 0)"),
  "no handler ledger row is created without an incremental handler fee"
);
assert.ok(
  kennelPrestigeService.includes("if (award.showEntry.handlerUsed)"),
  "championship prestige uses the finishing award's specific show entry"
);
assert.ok(
  kennelPrestigeService.includes("completionEntry.handlerUsed"),
  "grand-championship prestige uses the completion entry's specific attribution"
);
assert.ok(
  !kennelPrestigeService.includes("LedgerTransaction"),
  "prestige does not infer handling from handler-fee ledger rows"
);

assert.deepEqual(getGrandChampionMilestonePrestige(99), {
  milestoneCount: 0,
  prestige: 0,
});
assert.deepEqual(getGrandChampionMilestonePrestige(100), {
  milestoneCount: 1,
  prestige: 20,
});
assert.deepEqual(getGrandChampionMilestonePrestige(800), {
  milestoneCount: 4,
  prestige: 140,
});
assert.deepEqual(getGrandChampionMilestonePrestige(4000), {
  milestoneCount: 8,
  prestige: 240,
});

console.log("Kennel prestige tests passed.");
