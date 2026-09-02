import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const workspace = readFileSync("components/litters/LitterPuppyKennelRunWorkspace.tsx", "utf8");
const bulkRoute = readFileSync("app/api/litters/[litterId]/puppies/bulk-kennel-run/route.ts", "utf8");
const bulkService = readFileSync("server/services/litterBulkKennelRun.service.ts", "utf8");
const singleRoute = readFileSync("app/api/litters/[litterId]/puppies/[dogId]/kennel-run/route.ts", "utf8");
const moveService = readFileSync("server/services/kennelRunManagement.service.ts", "utf8");
const mapper = readFileSync("server/mappers/litter.mapper.ts", "utf8");

assert.match(client, /activeAction === "moveRun" && activeActionPartition/, "Move uses the shared action partition for one or many puppies");
assert.match(client, /eligiblePuppies=\{activeActionPartition\.eligiblePuppies\}/, "Move passes the action-eligible cohort");
assert.match(client, /skippedPuppies=\{activeActionPartition\.skippedPuppies\}/, "Move preserves action-level skips");
assert.match(client, /kennelRunResult/, "Move results remain visible in parent state after close");

assert.match(workspace, /fetch\("\/api\/kennel\/runs"/, "destination runs load on demand from the canonical endpoint");
assert.match(workspace, /Destination kennel run/, "one shared destination selector is labelled");
assert.match(workspace, /puppy\.kennelRun\?\.runId === targetRunId/, "same-target puppies are previewed as no-op skips");
assert.match(workspace, /Already in \{selectedRun\.name\}/, "same-target skip reasons name the selected destination");
assert.match(workspace, /dogIds: eligiblePuppies\.map/, "the request sends the full eligible cohort for server revalidation");
assert.match(workspace, /Confirm Move/, "confirmation is explicit");
assert.match(workspace, /role="status"/, "loading state is semantic");
assert.match(workspace, /role="alert"/, "errors are semantic");
assert.doesNotMatch(workspace, /modal|popover|drawer|Unassigned/i, "workspace is inline and adds no unassigned destination");

assert.match(bulkRoute, /parseMoveRequest/, "bulk route validates its narrow request shape");
assert.match(bulkRoute, /seenDogIds\.has/, "duplicate dog IDs are rejected");
assert.match(bulkService, /litter\.bredByKennelId !== args\.kennelId/, "bulk move verifies breeder-of-litter authority");
assert.match(bulkService, /targetRun\.kennelId !== args\.kennelId/, "bulk move verifies destination ownership first");
assert.match(bulkService, /dog\.litterId !== litter\.id/, "every dog is revalidated against litter membership");
assert.match(bulkService, /dog\.ownerKennelId !== args\.kennelId/, "every dog is revalidated against current ownership");
assert.match(bulkService, /dog\.kennelRunId === targetRun\.id/, "server skips same-target no-ops");
assert.match(bulkService, /moveDogsToKennelRun\(/, "one canonical multi-dog move performs the affected cohort mutation");
assert.match(bulkService, /db\.\$transaction/, "bulk move uses one transaction");
assert.doesNotMatch(bulkService, /kennelRunId:\s*targetRunId|deleteLitterRunIfEmpty|deleteEmptyLitterRuns/, "bulk wrapper adds no direct move or cleanup mutation");

assert.match(singleRoute, /export async function PATCH/, "single litter Move compatibility route remains intact");
assert.match(singleRoute, /moveDogsToKennelRun\(/, "single route remains canonical");
assert.match(moveService, /deleteLitterRunIfEmpty/, "canonical move service owns litter-run cleanup");
assert.doesNotMatch(mapper, /kennelRuns:/, "destination runs are not preloaded into the litter read model");

console.log("Litter puppy unified Kennel Run workspace checks passed.");
