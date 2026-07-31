import {
  MAX_LITTER_SIZE,
  MIN_LITTER_SIZE,
  REPRODUCTIVE_EMERGENCY_EXTENDED_RECOVERY_HOURS,
  REPRODUCTIVE_EMERGENCY_RULESET_VERSION,
  REPRODUCTIVE_EMERGENCY_TRIGGER_RATE,
  resolveReproductiveEmergencyOutcome,
  seeded01,
  shouldTriggerReproductiveEmergency,
  type ReproductiveEmergencyOutcomeResult,
} from "./index";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function outcome(seed: number, treatmentAuthorized: boolean, intendedPuppyCount = 8) {
  return resolveReproductiveEmergencyOutcome({
    rngSeed: seed,
    treatmentAuthorized,
    intendedPuppyCount,
    rulesetVersion: REPRODUCTIVE_EMERGENCY_RULESET_VERSION,
  });
}

function findOutcome(
  treatmentAuthorized: boolean,
  predicate: (result: ReproductiveEmergencyOutcomeResult) => boolean
) {
  for (let seed = 0; seed < 100_000; seed += 1) {
    const result = outcome(seed, treatmentAuthorized);
    if (predicate(result)) return result;
  }

  throw new Error("Could not find deterministic outcome matching test predicate.");
}

function assertAuditableOutcome(result: ReproductiveEmergencyOutcomeResult): void {
  const puppy = result.probabilities.puppySurvival;
  const expectedBand =
    result.rolls.puppyOutcomeRoll < puppy.allSurvive
      ? "ALL_SURVIVE"
      : result.rolls.puppyOutcomeRoll < puppy.allSurvive + puppy.mostSurvive
        ? "MOST_SURVIVE"
        : result.rolls.puppyOutcomeRoll <
            puppy.allSurvive + puppy.mostSurvive + puppy.fewSurvive
          ? "FEW_SURVIVE"
          : "NONE_SURVIVE";
  assertEqual(result.puppySurvivalBand, expectedBand, "returned puppy probabilities reproduce the selected band");

  const consequence = result.probabilities.reproductiveConsequence;
  const expectedConsequence =
    result.damOutcome === "DIED"
      ? "NONE"
      : result.rolls.reproductiveConsequenceRoll < consequence.none
        ? "NONE"
        : result.rolls.reproductiveConsequenceRoll <
            consequence.none + consequence.extendedRecovery
          ? "EXTENDED_RECOVERY"
          : "PERMANENT_BREEDING_RESTRICTION";
  assertEqual(
    result.reproductiveConsequence,
    expectedConsequence,
    "returned consequence probabilities reproduce the selected outcome"
  );
}

const identicalFirst = outcome(42_424, true);
const identicalSecond = outcome(42_424, true);
assertEqual(
  JSON.stringify(identicalFirst),
  JSON.stringify(identicalSecond),
  "identical inputs return byte-for-byte equivalent outcomes"
);

const trigger = shouldTriggerReproductiveEmergency({ rngSeed: 42_424 });
assertEqual(
  trigger.triggerRoll,
  seeded01("42424:reproductive-emergency:trigger"),
  "trigger uses the canonical seed namespace"
);
assertEqual(trigger.triggerRate, REPRODUCTIVE_EMERGENCY_TRIGGER_RATE, "trigger rate");
assertEqual(
  trigger.triggered,
  trigger.triggerRoll < REPRODUCTIVE_EMERGENCY_TRIGGER_RATE,
  "trigger boundary behavior uses a strict lower-than comparison"
);

for (const intendedPuppyCount of [1, MIN_LITTER_SIZE, MAX_LITTER_SIZE]) {
  const result = outcome(80_000 + intendedPuppyCount, true, intendedPuppyCount);
  assert(
    result.survivingPuppyCount >= 0 &&
      result.survivingPuppyCount <= intendedPuppyCount,
    `survivor count remains bounded for intended litter size ${intendedPuppyCount}`
  );
}

const allSurvived = findOutcome(true, (result) => result.puppyOutcome === "ALL_SURVIVED");
const partialSurvival = findOutcome(
  true,
  (result) => result.puppyOutcome === "PARTIAL_SURVIVAL"
);
const zeroSurvival = findOutcome(true, (result) => result.puppyOutcome === "NONE_SURVIVED");
assertEqual(allSurvived.survivingPuppyCount, 8, "full puppy survival count");
assert(
  partialSurvival.survivingPuppyCount > 0 && partialSurvival.survivingPuppyCount < 8,
  "partial puppy survival count"
);
assertEqual(zeroSurvival.survivingPuppyCount, 0, "zero puppy survival count");

const deadDamWithPuppies = findOutcome(
  false,
  (result) => result.damOutcome === "DIED" && result.survivingPuppyCount > 0
);
const survivingDamWithoutPuppies = findOutcome(
  true,
  (result) => result.damOutcome === "SURVIVED" && result.survivingPuppyCount === 0
);
assertEqual(deadDamWithPuppies.reproductiveConsequence, "NONE", "dead dam consequence");
assertEqual(deadDamWithPuppies.recoveryHours, 0, "dead dam recovery");
assertEqual(survivingDamWithoutPuppies.damOutcome, "SURVIVED", "surviving dam with zero puppies");

const noConsequence = findOutcome(
  true,
  (result) => result.damOutcome === "SURVIVED" && result.reproductiveConsequence === "NONE"
);
const extendedRecovery = findOutcome(
  true,
  (result) => result.damOutcome === "SURVIVED" && result.reproductiveConsequence === "EXTENDED_RECOVERY"
);
const permanentRestriction = findOutcome(
  false,
  (result) =>
    result.damOutcome === "SURVIVED" &&
    result.reproductiveConsequence === "PERMANENT_BREEDING_RESTRICTION"
);
assertEqual(noConsequence.recoveryHours, 0, "no consequence recovery");
assertEqual(
  extendedRecovery.recoveryHours,
  REPRODUCTIVE_EMERGENCY_EXTENDED_RECOVERY_HOURS,
  "extended recovery duration"
);
assertEqual(permanentRestriction.recoveryHours, 0, "permanent restriction recovery");

const treatedDamDeath = findOutcome(true, (result) => result.damOutcome === "DIED");
const treatedTotalPuppyLoss = findOutcome(
  true,
  (result) => result.puppyOutcome === "NONE_SURVIVED"
);
const untreatedDamSurvival = findOutcome(false, (result) => result.damOutcome === "SURVIVED");
const untreatedPuppySurvival = findOutcome(
  false,
  (result) => result.survivingPuppyCount > 0
);
assertEqual(treatedDamDeath.damOutcome, "DIED", "treated dam death remains possible");
assertEqual(
  treatedTotalPuppyLoss.puppyOutcome,
  "NONE_SURVIVED",
  "treated total puppy loss remains possible"
);
assertEqual(untreatedDamSurvival.damOutcome, "SURVIVED", "untreated dam survival remains possible");
assert(untreatedPuppySurvival.survivingPuppyCount > 0, "untreated puppy survival remains possible");

for (const result of [allSurvived, partialSurvival, zeroSurvival, extendedRecovery]) {
  assertAuditableOutcome(result);
  assert(
    result.rolls.damSurvivalRoll >= 0 && result.rolls.damSurvivalRoll < 1,
    "dam roll is auditable"
  );
  assert(
    result.rolls.puppyOutcomeRoll >= 0 && result.rolls.puppyOutcomeRoll < 1,
    "puppy-outcome roll is auditable"
  );
  assert(
    result.rolls.puppyCountRoll >= 0 && result.rolls.puppyCountRoll < 1,
    "puppy-count roll is auditable"
  );
  assert(
    result.rolls.reproductiveConsequenceRoll >= 0 &&
      result.rolls.reproductiveConsequenceRoll < 1,
    "consequence roll is auditable"
  );
  assertEqual(
    result.damOutcome,
    result.rolls.damSurvivalRoll < result.probabilities.damSurvivalRate
      ? "SURVIVED"
      : "DIED",
    "returned dam probability reproduces the selected outcome"
  );
}

for (const invalidCount of [0, -1, 1.5, Number.NaN]) {
  let threw = false;
  try {
    outcome(1, true, invalidCount);
  } catch {
    threw = true;
  }
  assert(threw, `invalid intended count ${invalidCount} is rejected`);
}

for (const invalidSeed of [Number.NaN, 1.5]) {
  let threw = false;
  try {
    resolveReproductiveEmergencyOutcome({
      rngSeed: invalidSeed,
      treatmentAuthorized: true,
      intendedPuppyCount: 8,
    });
  } catch {
    threw = true;
  }
  assert(threw, `invalid rng seed ${invalidSeed} is rejected`);
}

let unsupportedRulesetThrew = false;
try {
  shouldTriggerReproductiveEmergency({
    rngSeed: 1,
    rulesetVersion: "REPRODUCTIVE_EMERGENCY_V0",
  });
} catch {
  unsupportedRulesetThrew = true;
}
assert(unsupportedRulesetThrew, "unsupported ruleset is rejected");

const SAMPLE_SIZE = 20_000;
let treatedDamSurvivors = 0;
let untreatedDamSurvivors = 0;
let treatedPuppySurvivors = 0;
let untreatedPuppySurvivors = 0;
let treatedPermanentRestrictions = 0;
let untreatedPermanentRestrictions = 0;
let treatedDeaths = 0;
let treatedTotalLosses = 0;
let untreatedSurvivors = 0;
let untreatedLittersWithSurvivors = 0;

for (let seed = 0; seed < SAMPLE_SIZE; seed += 1) {
  const treated = outcome(seed, true);
  const untreated = outcome(seed, false);

  treatedPuppySurvivors += treated.survivingPuppyCount;
  untreatedPuppySurvivors += untreated.survivingPuppyCount;
  if (treated.damOutcome === "SURVIVED") {
    treatedDamSurvivors += 1;
    if (treated.reproductiveConsequence === "PERMANENT_BREEDING_RESTRICTION") {
      treatedPermanentRestrictions += 1;
    }
  } else {
    treatedDeaths += 1;
  }
  if (treated.survivingPuppyCount === 0) treatedTotalLosses += 1;
  if (untreated.damOutcome === "SURVIVED") {
    untreatedDamSurvivors += 1;
    untreatedSurvivors += 1;
    if (untreated.reproductiveConsequence === "PERMANENT_BREEDING_RESTRICTION") {
      untreatedPermanentRestrictions += 1;
    }
  }
  if (untreated.survivingPuppyCount > 0) untreatedLittersWithSurvivors += 1;
}

const treatedDamSurvivalRate = treatedDamSurvivors / SAMPLE_SIZE;
const untreatedDamSurvivalRate = untreatedDamSurvivors / SAMPLE_SIZE;
const treatedMeanPuppySurvivors = treatedPuppySurvivors / SAMPLE_SIZE;
const untreatedMeanPuppySurvivors = untreatedPuppySurvivors / SAMPLE_SIZE;
const treatedPermanentRestrictionRate = treatedPermanentRestrictions / treatedDamSurvivors;
const untreatedPermanentRestrictionRate =
  untreatedPermanentRestrictions / untreatedDamSurvivors;

assert(treatedDamSurvivalRate > untreatedDamSurvivalRate + 0.5, "treatment materially improves dam survival");
assert(
  treatedMeanPuppySurvivors > untreatedMeanPuppySurvivors + 2,
  "treatment materially improves mean puppy survival"
);
assert(
  treatedPermanentRestrictionRate < untreatedPermanentRestrictionRate,
  "treatment lowers permanent breeding restrictions among survivors"
);
assert(treatedDeaths > 0, "treated outcomes include a dam death");
assert(treatedTotalLosses > 0, "treated outcomes include total puppy loss");
assert(untreatedSurvivors > 0, "untreated outcomes include a dam survivor");
assert(untreatedLittersWithSurvivors > 0, "untreated outcomes include surviving puppies");

console.log(
  JSON.stringify({
    sampleSize: SAMPLE_SIZE,
    treated: {
      damSurvivalRate: treatedDamSurvivalRate,
      meanPuppySurvivors: treatedMeanPuppySurvivors,
      permanentRestrictionRate: treatedPermanentRestrictionRate,
      deaths: treatedDeaths,
      totalPuppyLosses: treatedTotalLosses,
    },
    untreated: {
      damSurvivalRate: untreatedDamSurvivalRate,
      meanPuppySurvivors: untreatedMeanPuppySurvivors,
      permanentRestrictionRate: untreatedPermanentRestrictionRate,
      survivors: untreatedSurvivors,
      littersWithSurvivors: untreatedLittersWithSurvivors,
    },
  })
);
