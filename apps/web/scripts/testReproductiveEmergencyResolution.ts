import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveReproductiveEmergencyOutcome } from "@showring/rules";

const resolver = readFileSync("apps/web/server/services/reproductiveEmergencyResolution.service.ts", "utf8");
const panel = readFileSync("apps/web/components/dogs/ReproductiveEmergencyPanel.tsx", "utf8");
const treatment = readFileSync("apps/web/server/services/reproductiveEmergencyTreatment.service.ts", "utf8");

assert.match(resolver, /resolveReproductiveEmergencyEvent/);
assert.match(resolver, /"TREATED" \| "UNTREATED_EXPIRED"/);
assert.match(resolver, /args\.currentEpoch <= event\.responseDeadlineEpoch/);
assert.match(resolver, /resolveReproductiveEmergencyOutcome/);
assert.match(resolver, /status: treated \? "RESOLVED_TREATED" : "RESOLVED_UNTREATED"/);
assert.match(resolver, /pupCount: outcome\.survivingPuppyCount/);
assert.match(resolver, /allowSinglePuppy: true/);
assert.match(resolver, /if \(outcome\.survivingPuppyCount > 0\)/);
assert.match(resolver, /getReproductiveEmergencyOutcomeNoticeSourceKey/);
assert.match(resolver, /markDogDeceased/);
assert.match(resolver, /processExpiredReproductiveEmergencyEvents/);
assert.match(panel, /authorize-treatment/);
assert.match(panel, /Treatment improves survival chances but does not guarantee survival/);
assert.match(panel, /Emergency treatment has been authorized\. The dam and litter outcome is still being resolved\./);
assert.match(treatment, /ledgerTransactionId: null/);
assert.match(treatment, /balance < event\.treatmentCost/);

for (const treatmentAuthorized of [true, false]) {
  for (const seed of [4, 27, 1024, 8991]) {
    const outcome = resolveReproductiveEmergencyOutcome({ rngSeed: seed, treatmentAuthorized, intendedPuppyCount: 5 });
    assert.ok(outcome.survivingPuppyCount >= 0 && outcome.survivingPuppyCount <= 5);
    assert.equal(resolveReproductiveEmergencyOutcome({ rngSeed: seed, treatmentAuthorized, intendedPuppyCount: 5 }).survivingPuppyCount, outcome.survivingPuppyCount);
  }
}

console.log("Reproductive emergency Stage 5 authorization and Stage 6 resolution source checks passed.");
