import assert from "node:assert/strict";
import { evaluateDamAgainstStudContractRequirements } from "../lib/studContractEligibility";

const requirements = (level: "NONE" | "GREEN_OR_YELLOW" | "GREEN_ONLY") => ({
  brucellosisNegativeRequired: false,
  titleRequirement: "NONE" as const,
  healthRequirements: [{ healthTestCode: "HIP_DYSPLASIA", requirementLevel: level }],
});
const dam = (resultCode: string | null, testedAtEpoch = 1) => ({
  hasValidNegativeBrucellosis: true,
  healthResults: resultCode
    ? [{ healthTestCode: "HIP_DYSPLASIA", resultCode, testedAtEpoch, createdAtEpoch: testedAtEpoch, id: resultCode }]
    : [],
  titleDog: {},
});
const eligible = (level: "NONE" | "GREEN_OR_YELLOW" | "GREEN_ONLY", result: string | null) =>
  evaluateDamAgainstStudContractRequirements(requirements(level), dam(result)).eligible;

for (const result of [null, "EXCELLENT", "BORDERLINE", "SEVERE"]) {
  assert.equal(eligible("NONE", result), true, "NONE never requires a result");
}
assert.equal(eligible("GREEN_OR_YELLOW", "EXCELLENT"), true);
assert.equal(eligible("GREEN_OR_YELLOW", "BORDERLINE"), true);
assert.equal(eligible("GREEN_OR_YELLOW", "SEVERE"), false);
assert.equal(eligible("GREEN_OR_YELLOW", null), false);
assert.equal(eligible("GREEN_ONLY", "EXCELLENT"), true);
assert.equal(eligible("GREEN_ONLY", "BORDERLINE"), false);
assert.equal(eligible("GREEN_ONLY", "SEVERE"), false);
assert.equal(eligible("GREEN_ONLY", null), false);

const hipGreenWithUnrestrictedCardiacRed =
  evaluateDamAgainstStudContractRequirements(
    {
      brucellosisNegativeRequired: false,
      titleRequirement: "NONE",
      healthRequirements: [
        { healthTestCode: "HIP_DYSPLASIA", requirementLevel: "GREEN_ONLY" },
        { healthTestCode: "CARDIAC", requirementLevel: "NONE" },
      ],
    },
    {
      ...dam("EXCELLENT"),
      healthResults: [
        { healthTestCode: "HIP_DYSPLASIA", resultCode: "EXCELLENT", testedAtEpoch: 2, createdAtEpoch: 2, id: "hip" },
        { healthTestCode: "CARDIAC", resultCode: "SEVERE", testedAtEpoch: 2, createdAtEpoch: 2, id: "cardiac" },
      ],
    }
  );
assert.equal(
  hipGreenWithUnrestrictedCardiacRed.eligible,
  true,
  "an unrelated Red result does not affect a configured per-test requirement"
);

const current = evaluateDamAgainstStudContractRequirements(requirements("GREEN_ONLY"), {
  ...dam("SEVERE", 1),
  healthResults: [
    { healthTestCode: "HIP_DYSPLASIA", resultCode: "SEVERE", testedAtEpoch: 1, createdAtEpoch: 1, id: "old" },
    { healthTestCode: "HIP_DYSPLASIA", resultCode: "EXCELLENT", testedAtEpoch: 2, createdAtEpoch: 2, id: "new" },
  ],
});
assert.equal(current.eligible, true, "newer completed result is authoritative");
assert.equal(current.health[0]?.currentResult?.resultCode, "EXCELLENT");
assert.equal(
  evaluateDamAgainstStudContractRequirements(
    { ...requirements("NONE"), brucellosisNegativeRequired: true },
    dam(null)
  ).eligible,
  true,
  "a valid current negative satisfies brucellosis"
);
assert.equal(
  evaluateDamAgainstStudContractRequirements(
    { ...requirements("NONE"), brucellosisNegativeRequired: true },
    { ...dam(null), hasValidNegativeBrucellosis: false }
  ).brucellosis.failureCode,
  "BRUCELLOSIS_NEGATIVE_REQUIRED"
);
assert.equal(
  evaluateDamAgainstStudContractRequirements(
    {
      ...requirements("NONE"),
      healthRequirements: [{ healthTestCode: "PATELLA", requirementLevel: "GREEN_ONLY" }],
    },
    {
      ...dam(null),
      healthResults: [{ healthTestCode: "PATELLA", resultCode: "NORMAL", testedAtEpoch: 1, createdAtEpoch: 1, id: "patella" }],
    }
  ).eligible,
  true,
  "configured canonical test codes do not require evaluator changes"
);

const title = (titleRequirement: "CH_OR_HIGHER" | "GCH_OR_HIGHER", prefix: string) =>
  evaluateDamAgainstStudContractRequirements(
    { ...requirements("NONE"), titleRequirement },
    { ...dam(null), titleDog: { visibleTitlePrefix: prefix } }
  ).eligible;
assert.equal(title("CH_OR_HIGHER", "CH"), true);
assert.equal(title("CH_OR_HIGHER", "GCHP"), true);
assert.equal(title("GCH_OR_HIGHER", "CH"), false);
assert.equal(title("GCH_OR_HIGHER", "GCHS"), true);

console.log("Stud Contract unified eligibility regression passed.");
