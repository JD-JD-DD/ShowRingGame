import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const litterService = readFileSync("server/services/litter.service.ts", "utf8");
const litterMapper = readFileSync("server/mappers/litter.mapper.ts", "utf8");
const detailSelect = litterService.slice(
  litterService.indexOf("const litterDetailSelect"),
  litterService.indexOf("type LitterDetailForMapping")
);

for (const field of [
  "litterId: true",
  "ownerKennel:",
  "breederKennel:",
  "kennelRun:",
  "marketState: true",
]) {
  assert.ok(detailSelect.includes(field), `detail select includes ${field}`);
}
assert.doesNotMatch(
  detailSelect,
  /dogListing|listings:/,
  "market state avoids an unnecessary DogListing join"
);
for (const field of [
  "callName: dog.callName",
  "registeredName: dog.registeredName ?? null",
  "visibleTitlePrefix: dog.visibleTitlePrefix ?? null",
  "visibleTitleSuffix: dog.visibleTitleSuffix ?? null",
  "currentOwnerKennel: dog.ownerKennel",
  "kennelRun: dog.kennelRun",
  "marketState: dog.marketState",
]) {
  assert.ok(litterMapper.includes(field), `mapper exposes ${field}`);
}
assert.match(
  litterMapper,
  /isBreederView = litter\.bredByKennel\?\.id === viewerKennelId/,
  "breeder view is derived from litter and viewer kennel identities"
);
assert.match(
  litterMapper,
  /!isNeonatalLoss[\s\S]*isBreederView[\s\S]*dog\.ownerKennel\?\.id === viewerKennelId[\s\S]*dog\.lifecycleState === "ALIVE"/,
  "manageability requires a real, breeder-owned, living puppy"
);
assert.match(
  litterService,
  /id: litterId,\s*\.\.\.visibleToKennelWhere\(kennelId\)/,
  "detail access remains breeder-scoped"
);
assert.match(
  litterService,
  /mapLitterDetail\(litterWithFreshHealthTruths, currentEpoch, kennelId\)/,
  "the server supplies the authoritative viewer kennel to the mapper"
);

function isManageable(fixture: {
  isNeonatalLoss: boolean;
  isBreederView: boolean;
  ownerKennelId: string | null;
  viewerKennelId: string;
  lifecycleState: string;
}) {
  return !fixture.isNeonatalLoss && fixture.isBreederView && fixture.ownerKennelId === fixture.viewerKennelId && fixture.lifecycleState === "ALIVE";
}

const breeder = "breeder";
assert.equal(isManageable({ isNeonatalLoss: false, isBreederView: true, ownerKennelId: breeder, viewerKennelId: breeder, lifecycleState: "ALIVE" }), true);
assert.equal(isManageable({ isNeonatalLoss: false, isBreederView: true, ownerKennelId: "buyer", viewerKennelId: breeder, lifecycleState: "ALIVE" }), false, "transferred puppy remains non-manageable");
assert.equal(isManageable({ isNeonatalLoss: false, isBreederView: true, ownerKennelId: breeder, viewerKennelId: breeder, lifecycleState: "DECEASED" }), false, "deceased puppy remains non-manageable");
assert.equal(isManageable({ isNeonatalLoss: false, isBreederView: true, ownerKennelId: null, viewerKennelId: breeder, lifecycleState: "TRANSFERRED" }), false, "re-homed puppy remains non-manageable");
assert.equal(isManageable({ isNeonatalLoss: true, isBreederView: true, ownerKennelId: breeder, viewerKennelId: breeder, lifecycleState: "ALIVE" }), false, "litter-loss entry remains non-manageable");

console.log("Litter detail management read-model checks passed.");
