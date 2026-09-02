import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const workspace = readFileSync("components/litters/LitterPuppyRehomeWorkspace.tsx", "utf8");
const bulkRoute = readFileSync("app/api/litters/[litterId]/puppies/bulk-rehome/route.ts", "utf8");
const bulkService = readFileSync("server/services/litterBulkRehome.service.ts", "utf8");
const singleRoute = readFileSync("app/api/litters/[litterId]/puppies/[dogId]/rehome/route.ts", "utf8");
const rehome = readFileSync("server/services/rehome.service.ts", "utf8");

assert.match(client, /activeAction === "rehome" && activeActionPartition/, "Re-home uses the shared action partition for one or many puppies");
assert.match(client, /eligiblePuppies=\{activeActionPartition\.eligiblePuppies\}/, "Re-home passes the action-eligible cohort");
assert.match(client, /skippedPuppies=\{activeActionPartition\.skippedPuppies\}/, "Re-home preserves action-level skips");
assert.match(client, /rehomeResult/, "Re-home outcomes remain visible after selection reconciliation");

assert.match(workspace, /eligiblePuppies\.map[\s\S]*puppy\.displayName[\s\S]*puppy\.regNumber/, "confirmation explicitly identifies every affected puppy");
assert.match(workspace, /skippedPuppies\.map[\s\S]*rehomeDisabledReason/, "confirmation separately identifies skipped puppies and server reasons");
assert.match(workspace, /removes them from your active kennel/, "consequence copy states active-kennel removal");
assert.match(workspace, /not casually reversible/, "consequence copy states reversibility clearly");
assert.match(workspace, /pedigrees, this litter record, and historical records/, "consequence copy preserves history and pedigree");
assert.match(workspace, /Confirm Re-home/, "confirmation control states its consequence");
assert.match(workspace, /pluralizePuppies/, "multiple-puppy confirmation uses locale-aware grammar");
assert.match(workspace, /role="alert"/, "expected errors remain inline and accessible");
assert.doesNotMatch(workspace, /modal|popover|drawer|confirm\(|TRANSFERRED/i, "workspace uses no overlay, browser confirmation, or internal lifecycle copy");

assert.match(bulkRoute, /parseDogIds/, "bulk route validates its narrow request shape");
assert.match(bulkService, /litter\.bredByKennelId !== args\.kennelId/, "litter breeder authority is whole-operation authorization");
assert.match(bulkService, /dog\.litterId !== litter\.id/, "every submitted puppy is revalidated against litter membership");
assert.match(bulkService, /dog\.ownerKennelId !== args\.kennelId/, "every submitted puppy is revalidated against current ownership");
assert.match(bulkService, /getDogRehomeEligibility\(/, "litter wrapper uses canonical Re-home eligibility");
assert.match(bulkService, /rehomeOwnedDogs\(/, "remaining eligible puppies re-home through one canonical batch");
assert.doesNotMatch(bulkService, /lifecycleState:\s*"TRANSFERRED"|ownerKennelId:\s*null|kennelRunId:\s*null|marketState:|dogListing\.|ledgerTransaction|deleteEmptyLitterRuns/, "litter wrapper has no direct canonical-state, listing, ledger, or cleanup mutation");

assert.match(singleRoute, /export async function POST/, "single litter Re-home compatibility route remains intact");
assert.match(rehome, /getDogRehomeEligibility\(/, "canonical re-home mutation reuses shared eligibility");
assert.match(rehome, /lifecycleState: "TRANSFERRED"/, "canonical lifecycle outcome remains unchanged");
assert.match(rehome, /deleteEmptyLitterRuns/, "canonical re-home owns litter-run cleanup");
assert.match(rehome, /extinguishStudContractReturnServicesForDogs/, "canonical re-home owns return-service cleanup");
assert.match(rehome, /transactionType: "PUPPY_REHOME"/, "canonical re-home owns payout ledger behavior");

console.log("Litter puppy unified Re-home workspace checks passed.");
