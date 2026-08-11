import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const litterServiceSource = readFileSync(
  "server/services/litter.service.ts",
  "utf8"
);

const visibilityHelper = litterServiceSource.match(
  /function visibleToKennelWhere\(kennelId: string\) \{([\s\S]*?)\n\}/
);

assert.ok(visibilityHelper, "litter visibility helper should exist");
assert.match(
  visibilityHelper[1],
  /return \{\s*bredByKennelId: kennelId,?\s*\};/,
  "My Litters visibility should use only canonical breeder ownership"
);
assert.doesNotMatch(
  visibilityHelper[1],
  /\bOR\b|ownerKennelId|\bsire\b|\bpuppies\b/,
  "current sire or puppy ownership must not widen My Litters visibility"
);

type LitterOwnershipFixture = {
  bredByKennelId: string;
  sireOwnerKennelId: string | null;
  damOwnerKennelId: string | null;
  puppyOwnerKennelIds: string[];
};

function isVisibleToKennel(
  litter: LitterOwnershipFixture,
  kennelId: string
): boolean {
  return litter.bredByKennelId === kennelId;
}

const alpha = "alpha";
const beta = "beta";

const alphaHistoricalLitter: LitterOwnershipFixture = {
  bredByKennelId: alpha,
  sireOwnerKennelId: beta,
  damOwnerKennelId: beta,
  puppyOwnerKennelIds: [beta],
};
assert.equal(isVisibleToKennel(alphaHistoricalLitter, alpha), true, "A: breeder retains litter after all dog transfers");
assert.equal(isVisibleToKennel(alphaHistoricalLitter, beta), false, "E: puppy transfers do not move breeder history");

const betaLitterWithAlphaSire: LitterOwnershipFixture = {
  bredByKennelId: beta,
  sireOwnerKennelId: alpha,
  damOwnerKennelId: beta,
  puppyOwnerKennelIds: [beta],
};
assert.equal(isVisibleToKennel(betaLitterWithAlphaSire, beta), true, "B: breeder sees its litter");
assert.equal(isVisibleToKennel(betaLitterWithAlphaSire, alpha), false, "B/F: sire ownership does not grant list or detail access");

const betaLitterWithAlphaPuppy: LitterOwnershipFixture = {
  bredByKennelId: beta,
  sireOwnerKennelId: beta,
  damOwnerKennelId: beta,
  puppyOwnerKennelIds: [alpha],
};
assert.equal(isVisibleToKennel(betaLitterWithAlphaPuppy, alpha), false, "C/F: puppy ownership does not grant list or detail access");

const betaLitterWithAlphaDam: LitterOwnershipFixture = {
  bredByKennelId: beta,
  sireOwnerKennelId: beta,
  damOwnerKennelId: alpha,
  puppyOwnerKennelIds: [beta],
};
assert.equal(isVisibleToKennel(betaLitterWithAlphaDam, alpha), false, "D: dam ownership does not grant historical access");

assert.match(
  litterServiceSource,
  /const archiveWhere = buildLitterArchiveWhere\(\{ kennelId, filters \}\)/,
  "filtered totals should use the shared breeder-scoped archive predicate"
);
assert.match(
  litterServiceSource,
  /db\.litter\.aggregate\(\{\s*where: archiveWhere/,
  "filtered totals should use canonical breeder ownership"
);
assert.match(
  litterServiceSource,
  /id: litterId,\s*\.\.\.visibleToKennelWhere\(kennelId\)/,
  "litter detail authorization should use canonical breeder ownership"
);

console.log("Litter ownership semantics checks passed.");
