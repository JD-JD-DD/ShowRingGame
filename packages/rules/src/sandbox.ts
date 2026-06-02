import {
  buildRegNumber,
  createBreedingAttempt,
  resolvePregnancyCheck,
  resolveWhelp,
  type BreedingDog,
} from "../engines/breeding.engine";
import {
  GESTATION_HOURS,
  MIN_BREED_AGE_HOURS,
  PREG_CHECK_HOURS,
  WHELPING_COOLDOWN_HOURS,
} from "../constants/lifecycle.constants";
import type { DogTraits } from "../engines/dog.engine";

function printHeader(title: string): void {
  console.log("\n========================================");
  console.log(title);
  console.log("========================================");
}

const now = 5000;

const validSire: BreedingDog = {
  dogId: "dog-sire-001",
  breedCode2: "WI",
  birthEpoch: now - MIN_BREED_AGE_HOURS - 500,
  sex: "M",
  status: "ALIVE",
};

const validDam: BreedingDog = {
  dogId: "dog-dam-001",
  breedCode2: "WI",
  birthEpoch: now - MIN_BREED_AGE_HOURS - 300,
  sex: "F",
  status: "ALIVE",
};

const underageDam: BreedingDog = {
  dogId: "dog-dam-002",
  breedCode2: "WI",
  birthEpoch: now - MIN_BREED_AGE_HOURS + 10,
  sex: "F",
  status: "ALIVE",
};

const wrongBreedDam: BreedingDog = {
  dogId: "dog-dam-003",
  breedCode2: "GS",
  birthEpoch: now - MIN_BREED_AGE_HOURS - 100,
  sex: "F",
  status: "ALIVE",
};

const sampleTraits: DogTraits = {
  head: 10,
  forequarters: 10,
  hindquarters: 10,
  gait: 10,
  coat: 10,
  size: 10,
  temperament: 10,
  show_shine: 10,
  feet: 10,
  topline: 10,
};

function runScenarioValidBreedingAttempt(): void {
  printHeader("SCENARIO 1: VALID BREEDING ATTEMPT");

  const attempt = createBreedingAttempt({
    attemptId: "attempt-001",
    currentEpoch: now,
    sire: validSire,
    dam: validDam,
    rngSeed: 12345,
  });

  console.log(JSON.stringify(attempt, null, 2));
}

function runScenarioUnderageDamFails(): void {
  printHeader("SCENARIO 2: UNDERAGE DAM FAILS");

  try {
    createBreedingAttempt({
      attemptId: "attempt-002",
      currentEpoch: now,
      sire: validSire,
      dam: underageDam,
      rngSeed: 12345,
    });

    console.log("ERROR: scenario should have failed");
  } catch (err) {
    console.log((err as Error).message);
  }
}

function runScenarioBreedMismatchFails(): void {
  printHeader("SCENARIO 3: BREED MISMATCH FAILS");

  try {
    createBreedingAttempt({
      attemptId: "attempt-003",
      currentEpoch: now,
      sire: validSire,
      dam: wrongBreedDam,
      rngSeed: 12345,
    });

    console.log("ERROR: scenario should have failed");
  } catch (err) {
    console.log((err as Error).message);
  }
}

function runScenarioPregnancyMiss(): void {
  printHeader("SCENARIO 4: PREGNANCY CHECK FAILS");

  const attempt = createBreedingAttempt({
    attemptId: "attempt-004",
    currentEpoch: now,
    sire: validSire,
    dam: validDam,
    rngSeed: 22222,
  });

  const checked = resolvePregnancyCheck({
    attempt,
    currentEpoch: now + PREG_CHECK_HOURS,
    conceptionRate: 0.75,
    conceptionRoll: 0.90,
  });

  console.log(JSON.stringify(checked, null, 2));
}

function runScenarioPregnancySuccessAndWhelp(): void {
  printHeader("SCENARIO 5: PREGNANCY SUCCESS AND WHELP");

  const attempt = createBreedingAttempt({
    attemptId: "attempt-005",
    currentEpoch: now,
    sire: validSire,
    dam: validDam,
    rngSeed: 67890,
  });

  const pregnant = resolvePregnancyCheck({
    attempt,
    currentEpoch: now + PREG_CHECK_HOURS,
    conceptionRate: 0.75,
    conceptionRoll: 0.10,
  });

  const outcome = resolveWhelp({
    attempt: pregnant,
    currentEpoch: now + GESTATION_HOURS,
    litterId: "litter-001",
    pupCount: 3,
    puppySexes: ["M", "F", "F"],
    puppyDogIds: ["pup-001", "pup-002", "pup-003"],
    sireTraits: sampleTraits,
    damTraits: sampleTraits,
    coiPercent: 0,
    coiGenerationDepth: 1,
  });

  console.log("Attempt:");
  console.log(JSON.stringify(outcome.attempt, null, 2));

  console.log("Litter:");
  console.log(JSON.stringify(outcome.litter, null, 2));

  console.log("Puppies:");
  console.log(JSON.stringify(outcome.puppies, null, 2));

  console.log("Dam repro update:");
  console.log(JSON.stringify(outcome.damReproUpdate, null, 2));

  console.log("Expected cooldown until:");
  console.log(now + GESTATION_HOURS + WHELPING_COOLDOWN_HOURS);
}

function runScenarioBuildRegNumbers(): void {
  printHeader("SCENARIO 6: REG NUMBER GENERATION");

  console.log(buildRegNumber("WI", "1234567", 1));
  console.log(buildRegNumber("WI", "1234567", 2));
  console.log(buildRegNumber("WI", "1234567", 3));
}

function main(): void {
  runScenarioValidBreedingAttempt();
  runScenarioUnderageDamFails();
  runScenarioBreedMismatchFails();
  runScenarioPregnancyMiss();
  runScenarioPregnancySuccessAndWhelp();
  runScenarioBuildRegNumbers();
}

main();
