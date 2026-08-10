import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

const lifecycle = source("apps/web/server/services/lifecycle.service.ts");
const emergencyVetCare = source("apps/web/server/services/emergencyVetCare.service.ts");
const litterMapper = source("apps/web/server/mappers/litter.mapper.ts");

assert.ok(
  lifecycle.includes('const isNeonatalLoss = cause === "NEONATAL_PUPPY";'),
  "only canonical neonatal deaths receive neonatal-loss visibility"
);
assert.ok(
  !lifecycle.includes("deathEpoch - birthEpoch < PUPPY_SALE_MIN_AGE_HOURS"),
  "young age no longer reclassifies accident/illness deaths as neonatal"
);
assert.ok(
  emergencyVetCare.includes('cause: "ACCIDENT_ILLNESS"'),
  "emergency-vet finalization retains the canonical accident/illness cause"
);
assert.ok(
  litterMapper.includes('puppy.visibilityState !== "HIDDEN_NEONATAL_LOSS"'),
  "litter neonatal-loss counts remain tied to canonical hidden-neonatal visibility"
);

console.log("Puppy death classification checks passed.");
