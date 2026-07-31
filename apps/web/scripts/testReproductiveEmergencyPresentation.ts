import assert from "node:assert/strict";
import { getReproductiveEmergencyPresentation } from "../lib/reproductiveEmergencyPresentation";

const base = { status: "RESOLVED_TREATED" as const, intendedPuppyCount: 5, survivingPuppyCount: 3, damOutcome: "SURVIVED" as const, reproductiveConsequence: "EXTENDED_RECOVERY" as const, recoveryUntilEpoch: 1365, litterId: "litter-1" };
const partial = getReproductiveEmergencyPresentation(base);
assert.equal(partial.treatmentLabel, "Emergency treatment was authorized.");
assert.equal(partial.damOutcomeLabel, "Dam survived");
assert.equal(partial.puppyOutcome, "3 of 5 puppies survived the whelping emergency.");
assert.match(partial.consequenceMessage ?? "", /extended recovery/);
assert.equal(partial.litterHref, "/litters/litter-1");
const none = getReproductiveEmergencyPresentation({ ...base, status: "RESOLVED_UNTREATED", survivingPuppyCount: 0, damOutcome: "DIED", reproductiveConsequence: "NONE", recoveryUntilEpoch: null, litterId: null });
assert.match(none.treatmentLabel, /deadline passed/);
assert.equal(none.damOutcomeLabel, "Dam died");
assert.equal(none.puppyOutcome, "None of the 5 puppies survived the whelping emergency.");
assert.equal(none.consequenceMessage, null);
console.log("Reproductive emergency presentation checks passed.");
