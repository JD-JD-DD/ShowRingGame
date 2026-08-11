import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveReproductiveEmergencyOutcome } from "@showring/rules";

const resolver = readFileSync("apps/web/server/services/reproductiveEmergencyResolution.service.ts", "utf8");
const panel = readFileSync("apps/web/components/dogs/ReproductiveEmergencyPanel.tsx", "utf8");
const treatment = readFileSync("apps/web/server/services/reproductiveEmergencyTreatment.service.ts", "utf8");

assert.match(resolver, /resolveReproductiveEmergencyEvent/);
assert.match(resolver, /"TREATED" \| "UNTREATED"/);
assert.match(resolver, /"PLAYER_DECLINED" \| "RESPONSE_EXPIRED"/);
assert.match(resolver, /args\.currentEpoch <= event\.responseDeadlineEpoch/);
assert.match(resolver, /resolveReproductiveEmergencyOutcome/);
assert.match(resolver, /status: treated \? "RESOLVED_TREATED" : "RESOLVED_UNTREATED"/);
assert.match(resolver, /pupCount: outcome\.survivingPuppyCount/);
assert.match(resolver, /allowSinglePuppy: true/);
assert.match(resolver, /if \(outcome\.survivingPuppyCount > 0\)/);
assert.match(resolver, /getReproductiveEmergencyOutcomeNoticeSourceKey/);
assert.match(resolver, /markDogDeceased/);
assert.match(resolver, /processExpiredReproductiveEmergencyEvents/);
assert.match(resolver, /status: "TREATMENT_DECLINED"/);
assert.match(resolver, /responseDeadlineEpoch: \{ lt: args\.currentEpoch \}/);
assert.match(panel, /authorize-treatment/);
assert.match(panel, /decline-treatment/);
assert.match(panel, /Emergency treatment greatly improves the chances of saving the dam and puppies, but survival is not guaranteed/);
assert.match(panel, /You have 48 real hours to choose whether to authorize emergency veterinary treatment\./);
assert.match(panel, /You do not need to remain online\. If you make no choice before the deadline, the emergency will resolve without treatment\./);
assert.match(panel, /Without emergency treatment, the risk of losing the dam and puppies is much higher, but survival is still possible\./);
assert.match(panel, /If you decline treatment, no veterinary treatment will be provided\. The outcome will be resolved within one game day — up to 1 real hour\./);
assert.match(panel, /No emergency treatment will be provided\. The outcome is being resolved and will be available within one game day \(up to 1 real hour\)\./);
assert.match(panel, /Treatment authorized/);
assert.match(panel, /Emergency veterinary treatment is now underway\. The outcome will be resolved within one game day — up to 1 real hour\./);
assert.match(panel, /You do not need to take any further action\. Return to this dog’s page after treatment is complete to see the outcome\./);
assert.match(panel, /Treatment in progress/);
assert.match(panel, /Veterinary care has been authorized\. The outcome will be available within one game day \(up to 1 real hour\)\./);
assert.match(treatment, /ledgerTransactionId: null/);
assert.match(treatment, /balance < event\.treatmentCost/);
assert.match(treatment, /declineReproductiveEmergencyTreatment/);
assert.match(treatment, /status: "TREATMENT_DECLINED"/);

for (const treatmentAuthorized of [true, false]) {
  for (const seed of [4, 27, 1024, 8991]) {
    const outcome = resolveReproductiveEmergencyOutcome({ rngSeed: seed, treatmentAuthorized, intendedPuppyCount: 5 });
    assert.ok(outcome.survivingPuppyCount >= 0 && outcome.survivingPuppyCount <= 5);
    assert.equal(resolveReproductiveEmergencyOutcome({ rngSeed: seed, treatmentAuthorized, intendedPuppyCount: 5 }).survivingPuppyCount, outcome.survivingPuppyCount);
  }
}

console.log("Reproductive emergency Stage 5 authorization and Stage 6 resolution source checks passed.");
