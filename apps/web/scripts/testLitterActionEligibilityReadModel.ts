import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const mapper = readFileSync("server/mappers/litter.mapper.ts", "utf8");
const litterService = readFileSync("server/services/litter.service.ts", "utf8");
const rehome = readFileSync("server/services/rehome.service.ts", "utf8");
const puppyCards = readFileSync("components/litters/LitterPuppyCardsClient.tsx", "utf8");
const puppyCard = readFileSync("components/litters/LitterPuppyCard.tsx", "utf8");

for (const field of ["canName", "canAssignRegisteredName", "canMoveRun", "canListForSale", "canRehome"]) {
  assert.match(mapper, new RegExp(`${field}:`), `DTO includes ${field}`);
}
assert.match(mapper, /dog\.litterId === litterId/, "litter membership is explicit for action authority");
assert.match(mapper, /getDogSaleEligibility\(\{ dogId: dog\.id, sellerKennelId: viewerKennelId, currentEpoch \}\)/, "sale eligibility reuses the canonical helper");
assert.match(mapper, /getDogRehomeEligibility\(\{ dogId: dog\.id, kennelId: viewerKennelId, currentEpoch \}\)/, "re-home eligibility reuses the canonical helper");
assert.match(mapper, /canAssignRegisteredName: hasLitterManagementAuthority && !dog\.registeredName\?\.trim\(\)/, "registered names remain one-time");
assert.match(mapper, /isManageableByBreeder,\s*actionEligibility:/, "structural and action eligibility remain distinct");
assert.match(rehome, /export async function getDogRehomeEligibility/, "re-home has a reusable canonical preflight");
assert.match(rehome, /getDogRehomeEligibility\(\{ dogId, kennelId: args\.kennelId/, "re-home mutation reuses its preflight");
assert.match(litterService, /await mapLitterDetail/, "detail service awaits asynchronous eligibility mapping");
for (const source of [puppyCards, puppyCard]) {
  assert.doesNotMatch(source, /canListForSale|canRehome|breederNote/, "Stage 3B adds no visible puppy action UI or private note boundary");
}

console.log("Litter action eligibility read-model checks passed.");
