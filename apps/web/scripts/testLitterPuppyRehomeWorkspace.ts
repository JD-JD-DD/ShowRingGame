import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const workspace = readFileSync("components/litters/LitterPuppyRehomeWorkspace.tsx", "utf8");
const route = readFileSync("app/api/litters/[litterId]/puppies/[dogId]/rehome/route.ts", "utf8");
const rehome = readFileSync("server/services/rehome.service.ts", "utf8");

assert.match(client, /"name" \| "moveRun" \| "sale" \| "rehome" \| null/, "one active workspace supports all four functional actions");
assert.match(client, /Re-home/, "Re-home is visible in the shared action seam");
assert.match(client, /disabled=\{!selectedPuppy\.actionEligibility\.canRehome\}/, "re-home availability is server-authoritative");
assert.match(client, /rehomeDisabledReason/, "re-home unavailability visibly uses the server reason");
assert.match(client, /<LitterPuppyRehomeWorkspace/, "Re-home opens an inline confirmation workspace");

assert.match(workspace, /Re-home Puppy/, "workspace identifies the destructive action");
assert.match(workspace, /puppy\.displayName[\s\S]*puppy\.regNumber/, "workspace identifies the selected puppy and registration number");
assert.match(workspace, /removes it from your active kennel/, "consequence copy states active-kennel removal");
assert.match(workspace, /not casually reversible/, "consequence copy states reversibility clearly");
assert.match(workspace, /litter record, its pedigree, and historical records/, "consequence copy preserves history and pedigree");
assert.match(workspace, /Confirm Re-home/, "confirmation control states its consequence");
assert.match(workspace, />\s*Cancel\s*</, "cancel is explicit");
assert.match(workspace, /role="alert"/, "expected errors remain inline and accessible");
assert.match(workspace, /onAuthoritativeRefresh\(\)/, "success and stale failures refresh authoritative state");
assert.doesNotMatch(workspace, /modal|popover|drawer|confirm\(/i, "workspace uses no overlay or browser confirmation");

assert.match(route, /export async function POST/, "litter re-home uses a narrow POST route");
assert.match(route, /litter\.bredByKennelId !== kennel\.id/, "route verifies breeder-of-litter authority");
assert.match(route, /puppy\.litterId !== litter\.id/, "route verifies puppy membership");
assert.match(route, /puppy\.ownerKennelId !== kennel\.id/, "route verifies current ownership");
assert.match(route, /rehomeOwnedDogs\(/, "route delegates to the canonical re-home service");
assert.doesNotMatch(route, /lifecycleState:\s*"TRANSFERRED"|ownerKennelId:\s*null|kennelRunId:\s*null|marketState:\s*"NOT_FOR_SALE"|dogListing\.|ledgerTransaction|deleteEmptyLitterRuns/, "route has no direct canonical-state, listing, ledger, or cleanup mutation");
assert.match(rehome, /getDogRehomeEligibility\(/, "canonical re-home mutation reuses shared eligibility");
assert.match(rehome, /lifecycleState: "TRANSFERRED"/, "canonical lifecycle outcome remains unchanged");
assert.match(rehome, /deleteEmptyLitterRuns/, "canonical re-home owns litter-run cleanup");
assert.match(rehome, /extinguishStudContractReturnServicesForDogs/, "canonical re-home owns return-service cleanup");
assert.match(rehome, /transactionType: "PUPPY_REHOME"/, "canonical re-home owns payout ledger behavior");

console.log("Litter puppy re-home workspace checks passed.");
