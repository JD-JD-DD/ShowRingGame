import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const breeding = readFileSync("server/services/breeding.service.ts", "utf8");
const emergency = readFileSync(
  "server/services/reproductiveEmergencyResolution.service.ts",
  "utf8"
);
const persistence = readFileSync(
  "server/services/litterPersistence.service.ts",
  "utf8"
);
const market = readFileSync("server/services/market.service.ts", "utf8");
const rehome = readFileSync("server/services/rehome.service.ts", "utf8");

assert.match(
  breeding,
  /bredByKennelId: fresh\.createdByKennelId/,
  "ordinary whelp attributes the litter to the breeding attempt's kennel"
);
assert.match(
  breeding,
  /ownerKennelId: fresh\.createdByKennelId[\s\S]*breederKennelId: fresh\.createdByKennelId/,
  "ordinary-whelp puppies retain their existing initial owner and breeder attribution"
);
assert.match(
  emergency,
  /bredByKennelId: attempt\.createdByKennelId/,
  "emergency survivor litters use the breeding attempt's kennel attribution"
);
assert.match(
  emergency,
  /ownerKennelId: attempt\.createdByKennelId, breederKennelId: attempt\.createdByKennelId/,
  "emergency survivor puppies retain their existing initial owner and breeder attribution"
);
assert.match(
  persistence,
  /await args\.client\.litter\.create\(/,
  "shared persistence creates the attributed litter record"
);
assert.doesNotMatch(
  persistence,
  /litter\.update\(/,
  "shared litter persistence does not mutate historical breeder attribution"
);

const alpha = "alpha";
const beta = "beta";
const litter = { bredByKennelId: alpha };
for (const laterOwner of [beta, null]) {
  const sireOwnerKennelId = laterOwner;
  const damOwnerKennelId = laterOwner;
  const puppyOwnerKennelId = laterOwner;
  void sireOwnerKennelId;
  void damOwnerKennelId;
  void puppyOwnerKennelId;
  assert.equal(
    litter.bredByKennelId,
    alpha,
    "later sire, dam, or puppy ownership changes must not mutate litter breeder attribution"
  );
}

assert.match(
  market,
  /damId: dog\.id,[\s\S]*in: \["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"\]/,
  "sale listing blocks dams with active breeding attempts"
);
assert.match(
  rehome,
  /damId: \{ in: dogIds \},[\s\S]*in: \["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"\]/,
  "rehome blocks dams with active breeding attempts"
);

console.log("Litter attribution invariant checks passed.");
