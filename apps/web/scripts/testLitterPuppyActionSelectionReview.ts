import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");

assert.match(client, /const selectedPuppies = useMemo[\s\S]*puppies\.filter[\s\S]*selectedPuppyIds\.has/, "selected puppies are derived from current props and the canonical Set");
assert.match(client, /PUPPY_ACTIONS: Record/, "the four action projections share one narrow local descriptor map");
for (const field of [
  "canName",
  "nameDisabledReason",
  "canMoveRun",
  "moveRunDisabledReason",
  "canListForSale",
  "saleDisabledReason",
  "canRehome",
  "rehomeDisabledReason",
]) {
  assert.match(client, new RegExp(field), `review reads the existing ${field} value`);
}
assert.match(client, /eligiblePuppies: selectedPuppies\.filter[\s\S]*skippedPuppies: selectedPuppies\.filter/, "each active action independently partitions the selected cohort");
assert.match(client, /Name[\s\S]*Move Kennel Run[\s\S]*Put Up for Sale[\s\S]*Re-home/, "the shared action order remains stable for every cohort size");
assert.match(client, /selectedPuppies\.length > 0/, "shared actions render for one or many selected puppies");
assert.match(client, /activeActionPartition\.eligiblePuppies\.length === 0/, "zero eligible actions open an explanatory non-executable review");
assert.match(client, /Skipped[\s\S]*disabledReason\(puppy\)[\s\S]*This action is not currently available for this puppy\./, "skipped rows show server reasons with a safe presentation fallback");
assert.match(client, /selectedPuppies\.length === 1[\s\S]*eligiblePuppies\.length === 1/, "only an exactly-one eligible cohort may render a legacy single-puppy workspace");
assert.match(client, /activeAction === "name" && singleEligiblePuppy/, "Name route stays guarded to one puppy");
assert.match(client, /activeAction === "moveRun" && singleEligiblePuppy/, "Move route stays guarded to one puppy");
assert.match(client, /activeAction === "sale" && singleEligiblePuppy/, "Sale route stays guarded to one puppy");
assert.match(client, /activeAction === "rehome" && singleEligiblePuppy/, "Re-home route stays guarded to one puppy");
assert.doesNotMatch(client, /bulk-|Eligible\/Skipped|actionEligibilityEngine/i, "Stage 4C adds no bulk mutation route or generalized eligibility engine");
assert.doesNotMatch(client, /breederNote|genotype|hidden health|traitHead/, "review receives no private litter or genetic data");

console.log("Litter puppy action selection review checks passed.");
