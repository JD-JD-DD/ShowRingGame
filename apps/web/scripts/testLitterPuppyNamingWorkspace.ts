import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const workspace = readFileSync("components/litters/LitterPuppyNameWorkspace.tsx", "utf8");
const bulkRoute = readFileSync("app/api/litters/[litterId]/puppies/bulk-name/route.ts", "utf8");
const bulkService = readFileSync("server/services/litterBulkNaming.service.ts", "utf8");
const litterRoute = readFileSync("app/api/litters/[litterId]/puppies/[dogId]/name/route.ts", "utf8");
const namingService = readFileSync("server/services/dogNaming.service.ts", "utf8");

assert.match(client, /activeAction === "name" && activeActionPartition/, "Name uses the shared action partition for one or many puppies");
assert.match(client, /eligiblePuppies=\{activeActionPartition\.eligiblePuppies\}/, "Name passes eligible puppies from Stage 4C");
assert.match(client, /skippedPuppies=\{activeActionPartition\.skippedPuppies\}/, "Name preserves the skipped cohort review");
assert.match(client, /namingResult/, "naming outcomes remain visible in parent state after the workspace closes");

assert.match(workspace, /eligiblePuppies\.map\(\(puppy\)/, "the unified workspace renders one independent row per eligible puppy");
assert.match(workspace, /puppy\.displayName[\s\S]*puppy\.regNumber/, "each naming row identifies its puppy and registration");
assert.match(workspace, /callNameChanged/, "only changed call names are submitted");
assert.match(workspace, /canAssignRegisteredName/, "registered-name availability stays a field-level condition");
assert.match(workspace, /Registered name is permanent once assigned\./, "assigned registered names remain read-only and explained");
assert.match(workspace, /Confirm permanent registered names\./, "new registered names require inline permanence confirmation");
assert.match(workspace, /updates\.length === 0/, "empty changes cannot submit");
assert.match(workspace, /role="alert"/, "canonical failures remain inline and accessible");
assert.match(workspace, /\/puppies\/bulk-name/, "one and many puppies use the same bulk-capable request path");
assert.doesNotMatch(workspace, /modal|popover|drawer/i, "workspace is inline");

assert.match(bulkRoute, /parseUpdates/, "bulk route validates its narrow request shape");
assert.match(bulkRoute, /dogIds\.has/, "duplicate dog IDs are rejected");
assert.match(bulkService, /litter\.bredByKennelId !== args\.kennelId/, "bulk naming establishes breeder authority for the litter");
assert.match(bulkService, /dog\.litterId !== litter\.id/, "every dog is revalidated against the litter");
assert.match(bulkService, /dog\.ownerKennelId !== args\.kennelId/, "every dog is revalidated against current ownership");
assert.match(bulkService, /dog\.lifecycleState !== "ALIVE"/, "structurally unavailable puppies are skipped");
assert.match(bulkService, /HIDDEN_NEONATAL_LOSS/, "hidden neonatal losses are skipped");
assert.match(bulkService, /updateDogNaming\(/, "each eligible row uses the canonical naming seam");
assert.match(bulkService, /db\.\$transaction/, "eligible naming updates run in one transaction");
assert.match(bulkService, /error\.status === 403 \|\| error\.status === 404/, "stale authorization races skip safely while canonical validation errors propagate");
assert.doesNotMatch(bulkService, /data:\s*\{[\s\S]*(callName|registeredName)/, "bulk naming adds no direct Prisma naming write");

assert.match(litterRoute, /export async function PATCH/, "the existing single litter naming route remains intact");
assert.match(litterRoute, /updateDogNaming\(/, "the existing single route remains canonical");
assert.match(namingService, /validateCallName/, "canonical call-name validation remains shared");
assert.match(namingService, /validateRegisteredDogName/, "canonical registered-name validation remains shared");
assert.match(namingService, /registeredName\?\.trim\(\)/, "registered-name permanence remains enforced");
assert.match(namingService, /mode: "insensitive"/, "registered-name uniqueness remains case-insensitive");

console.log("Litter puppy unified naming workspace checks passed.");
