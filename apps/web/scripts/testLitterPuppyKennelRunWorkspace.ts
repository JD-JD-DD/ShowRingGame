import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const workspace = readFileSync("components/litters/LitterPuppyKennelRunWorkspace.tsx", "utf8");
const route = readFileSync("app/api/litters/[litterId]/puppies/[dogId]/kennel-run/route.ts", "utf8");
const moveService = readFileSync("server/services/kennelRunManagement.service.ts", "utf8");
const mapper = readFileSync("server/mappers/litter.mapper.ts", "utf8");

assert.match(client, /"name" \| "moveRun" \| null/, "one extensible active workspace state supports Name and Move");
assert.match(client, /Move Kennel Run/, "Move Kennel Run is available in the shared action seam");
assert.match(client, /disabled=\{!selectedPuppy\.actionEligibility\.canMoveRun\}/, "move availability is server-authoritative");
assert.match(client, /moveRunDisabledReason/, "unavailable moves visibly explain the server reason");
assert.match(client, /<LitterPuppyKennelRunWorkspace/, "Move opens an inline workspace");

assert.match(workspace, /fetch\("\/api\/kennel\/runs"/, "destination runs load on demand from the canonical endpoint");
assert.match(workspace, /Current kennel run/, "current run is clearly displayed");
assert.match(workspace, /Destination kennel run/, "destination selector is labelled");
assert.match(workspace, /This puppy is already in this kennel run\./, "current-run selection prevents needless mutation churn");
assert.match(workspace, /onAuthoritativeRefresh\(\)/, "success and stale failures refresh authoritative state");
assert.match(workspace, /role="status"/, "loading state is semantic");
assert.match(workspace, /role="alert"/, "errors are semantic");
assert.doesNotMatch(workspace, /modal|popover|drawer/i, "workspace is inline");

assert.match(route, /export async function PATCH/, "litter move uses a narrow PATCH route");
assert.match(route, /litter\.bredByKennelId !== kennel\.id/, "route verifies breeder-of-litter authority");
assert.match(route, /puppy\.litterId !== litter\.id/, "route verifies puppy membership");
assert.match(route, /puppy\.ownerKennelId !== kennel\.id/, "route verifies current ownership");
assert.match(route, /targetRun\.kennelId !== kennel\.id/, "route verifies destination ownership");
assert.match(route, /moveDogsToKennelRun\(/, "route delegates to the canonical move service");
assert.doesNotMatch(route, /kennelRunId:\s*targetRunId/, "route never writes kennelRunId directly");
assert.doesNotMatch(route, /deleteLitterRunIfEmpty|deleteEmptyLitterRuns/, "cleanup remains canonical service behavior");
assert.match(moveService, /deleteLitterRunIfEmpty/, "canonical move service owns litter-run cleanup");
assert.doesNotMatch(mapper, /kennelRuns:/, "destination runs are not preloaded into the litter read model");

console.log("Litter puppy Kennel Run workspace checks passed.");
