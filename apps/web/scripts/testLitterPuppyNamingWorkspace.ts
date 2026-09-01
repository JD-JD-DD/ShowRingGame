import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const client = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const workspace = readFileSync("components/litters/LitterPuppyNameWorkspace.tsx", "utf8");
const litterRoute = readFileSync(
  "app/api/litters/[litterId]/puppies/[dogId]/name/route.ts",
  "utf8"
);
const namingService = readFileSync("server/services/dogNaming.service.ts", "utf8");
const callNameRoute = readFileSync("app/api/dogs/[dogId]/call-name/route.ts", "utf8");
const renameRoute = readFileSync("app/api/dogs/[dogId]/rename/route.ts", "utf8");

assert.match(client, /activeAction.*"name" \| null/, "one extensible naming workspace state is used");
assert.match(client, /disabled=\{!selectedPuppy\.actionEligibility\.canName\}/, "Name availability is server-authoritative");
assert.match(client, /nameDisabledReason/, "unavailable naming explains its server-provided reason");
assert.match(client, /<LitterPuppyNameWorkspace/, "Name opens only in the post-grid action seam");
assert.doesNotMatch(client, /Move Kennel Run|Put Up for Sale|Re-home/, "future actions are not rendered");
assert.match(client, /setActiveAction\(null\)[\s\S]*clearSelection/, "clearing selection closes and discards the workspace");
assert.match(client, /selectedPuppyId !== puppyId\) setActiveAction\(null\)/, "switching puppies closes the prior workspace");

assert.match(workspace, /Call name/, "workspace exposes call-name editing");
assert.match(workspace, /MAX_CALL_NAME_LENGTH/, "workspace uses the canonical call-name limit");
assert.match(workspace, /MAX_REGISTERED_NAME_LENGTH/, "workspace uses the canonical registered-name limit");
assert.match(workspace, /Registered name is permanent once assigned\./, "assigned registered names are read-only and explained");
assert.match(workspace, /router\.refresh\(\)/, "success and stale failures refresh authoritative litter state");
assert.match(workspace, /role="alert"/, "expected failures remain inline and accessible");
assert.doesNotMatch(workspace, /modal|popover|drawer/i, "workspace is inline");

assert.match(litterRoute, /export async function PATCH/, "litter naming uses a narrow PATCH endpoint");
assert.match(litterRoute, /litter\.bredByKennelId !== kennel\.id/, "route verifies litter breeder authority");
assert.match(litterRoute, /puppy\.litterId !== litter\.id/, "route verifies puppy litter membership");
assert.match(litterRoute, /puppy\.ownerKennelId !== kennel\.id/, "route verifies current ownership");
assert.match(litterRoute, /updateDogNaming\(/, "route delegates canonical naming behavior");
assert.match(namingService, /validateCallName/, "canonical call-name validation is shared");
assert.match(namingService, /validateRegisteredDogName/, "canonical registered-name validation is shared");
assert.match(namingService, /registeredName\?\.trim\(\)/, "registered-name permanence remains enforced");
assert.match(namingService, /mode: "insensitive"/, "registered-name uniqueness remains case-insensitive");
assert.match(namingService, /\$transaction/, "combined naming saves are atomic");
assert.match(callNameRoute, /updateDogNaming\(/, "existing call-name route uses the canonical seam");
assert.match(renameRoute, /updateDogNaming\(/, "existing registered-name route uses the canonical seam");

console.log("Litter puppy naming workspace checks passed.");
