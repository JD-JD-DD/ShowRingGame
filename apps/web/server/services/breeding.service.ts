import { db } from "@/lib/db";
import {
  toPersistedDogTraits,
  toRulesDogTraits,
  type PersistedDogTraitRecord,
} from "@/server/services/phenotypePersistence.service";
import { formatDogDisplayName } from "@/lib/dogNames";
import { isChampionOfRecordDog } from "@/lib/dogTitles";
import {
  getPhenotypeHealthSeverity,
  hasAllGreenRequiredPhenotypeHealthTests,
  hasCompletedRequiredPhenotypeHealthTests,
} from "@/lib/dogHealth";
import {
  createKennelNotice,
  createReproductiveEmergencyNotice,
} from "@/server/services/kennelNotice.service";
import { assertDogHasNoPendingVeterinaryCare } from "@/server/services/emergencyVetCare.service";
import { assertDamMeetsStudContractRequirements } from "@/server/services/studContractEligibility.service";
import { getBreedingEligibilityMessage, getIndividualBreedingEligibility } from "@/server/services/breedingEligibility.service";
import {
  deriveCurrentVisibleCategoriesForDogDisplay,
  DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES,
} from "@/server/services/dogVisibleCategories.service";
import { markDogDeceased } from "@/server/services/lifecycle.service";
import { evaluateStudContractWhelpQualification } from "@/server/services/studContractLifecycle.service";
import { openInitialStudContractPuppySelection } from "@/server/services/studContractPuppySelection.service";
import { createStudContractReturnService } from "@/server/services/studContractReturnService.service";
import {
  activePublicStudListingWhere,
  adaptLegacyPublicStudListing,
  resolvePublicStudForSire,
} from "@/server/services/publicStud.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import {
  ensureLitterKennelRun,
} from "@/server/services/kennelRun.service";
import { createLitterWithCollisionRetry } from "@/server/services/litterPersistence.service";
import { createPuppyGeneticsRandom01ForLitter } from "@/server/services/puppyGenetics.service";
import {
  getValidNegativeBrucellosisTest,
  infectPuppiesFromDamBrucellosis,
  runBrucellosisTest,
  transmitBrucellosisThroughBreeding,
} from "@/server/services/infectiousDisease.service";
import {
  BRUCELLOSIS_TEST_FEE,
  BREEDING_FEE,
  calculatePedigreeCoi,
  COI_CALCULATION_MAX_GENERATIONS,
  DAM_MAX_BREED_AGE_HOURS,
  getRequiredHealthTestsForBreed,
  MIN_BREED_AGE_HOURS,
  rollBreedingTiming,
  rollLitterSize,
  resolvePregnancyCheck,
  resolveWhelp,
  REPRODUCTIVE_EMERGENCY_RESPONSE_WINDOW_HOURS,
  REPRODUCTIVE_EMERGENCY_RULESET_VERSION,
  REPRODUCTIVE_EMERGENCY_TREATMENT_COST,
  WHELPING_COOLDOWN_HOURS,
  shouldTriggerReproductiveEmergency,
} from "@showring/rules";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

type DogForBreeding = PersistedDogTraitRecord & {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  breedCode2: string;
  sex: "M" | "F";
  birthEpoch: number;
  lifecycleState: string;
  ownerKennelId: string | null;
  isBreedingActive: boolean;
  breed: {
    name: string;
  };
  healthTests: Array<{
    testTypeCode: string;
    resultCode: string;
  }>;
  healthConditionTruths: Array<{
    conditionCode: string;
    geneticLiability: number;
    environmentModifier: number;
  }>;
};

type BreedingHealthConditionTruth = {
  dogId: string;
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

type AttemptForResolution = {
  id: string;
  sireId: string;
  damId: string;
  breedCode2: string;
  createdEpoch: number;
  pregCheckEpoch: number | null;
  dueEpoch: number | null;
  checkedEpoch: number | null;
  whelpedEpoch: number | null;
  isPregnant: boolean | null;
  status:
    | "INITIATED"
    | "CHECKED_NOT_PREGNANT"
    | "PREGNANT"
    | "REPRODUCTIVE_EMERGENCY"
    | "WHELPED"
    | "FAILED"
    | "CANCELLED";
  rngSeed: number | null;
  createdByKennelId: string | null;
  sire: PersistedDogTraitRecord & { id: string; genotype: string | null; geneticsVersion: string | null };
  dam: PersistedDogTraitRecord & { id: string; genotype: string | null; geneticsVersion: string | null };
};

type DueAttemptForResolution = {
  id: string;
  status: AttemptForResolution["status"];
  pregCheckEpoch: number | null;
  dueEpoch: number | null;
};

type PregnancyCheckResolutionOutcome =
  | {
      status: "PREGNANT" | "CHECKED_NOT_PREGNANT";
      dueEpoch: number | null;
    }
  | {
      status: "SKIPPED";
      dueEpoch: null;
    };

type WhelpingResolutionOutcome =
  | "WHELPED"
  | "REPRODUCTIVE_EMERGENCY"
  | "SKIPPED";


export type BreedingProgressResolutionSummary = {
  checkedCount: number;
  becamePregnantCount: number;
  didNotTakeCount: number;
  whelpedCount: number;
  skippedCount: number;
  failedCount: number;
};

function createBreedingProgressResolutionSummary(): BreedingProgressResolutionSummary {
  return {
    checkedCount: 0,
    becamePregnantCount: 0,
    didNotTakeCount: 0,
    whelpedCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };
}

function getReproductiveEmergencySourceKey(breedingAttemptId: string): string {
  return `REPRODUCTIVE_EMERGENCY:${breedingAttemptId}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function seeded01(seed: string): number {
  let hash = 2166136261;

  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return (hash >>> 0) / 0x100000000;
}

export function buildPuppySexes(seed: string, pupCount: number): Array<"M" | "F"> {
  return Array.from({ length: pupCount }, (_, index) =>
    seeded01(`${seed}:sex:${index}`) < 0.5 ? "M" : "F"
  );
}

function requireRngSeed(seed: number | null): number {
  if (seed === null) {
    throw new Error("Breeding attempt is missing its rngSeed.");
  }

  return seed;
}

export function mapBreedingTraits(dog: AttemptForResolution["sire"]) {
  return toRulesDogTraits(dog);
}

export async function loadPedigreeForCoi(
  client: Prisma.TransactionClient,
  parentIds: string[]
) {
  const pedigreeById = new Map<
    string,
    { id: string; sireId: string | null; damId: string | null }
  >();
  let currentIds = [...new Set(parentIds)];

  for (
    let generation = 0;
    generation < COI_CALCULATION_MAX_GENERATIONS && currentIds.length > 0;
    generation += 1
  ) {
    const dogs = await client.dog.findMany({
      where: {
        id: {
          in: currentIds,
        },
      },
      select: {
        id: true,
        sireId: true,
        damId: true,
      },
    });
    const nextIds = new Set<string>();

    for (const dog of dogs) {
      pedigreeById.set(dog.id, dog);

      if (dog.sireId && !pedigreeById.has(dog.sireId)) {
        nextIds.add(dog.sireId);
      }

      if (dog.damId && !pedigreeById.has(dog.damId)) {
        nextIds.add(dog.damId);
      }
    }

    currentIds = [...nextIds];
  }

  return [...pedigreeById.values()];
}

function getAgeHours(currentEpoch: number, birthEpoch: number): number {
  return Math.max(0, currentEpoch - birthEpoch);
}

function isBreedAgeEligible(dog: DogForBreeding, currentEpoch: number): boolean {
  const ageHours = getAgeHours(currentEpoch, dog.birthEpoch);

  if (ageHours < MIN_BREED_AGE_HOURS) {
    return false;
  }

  if (dog.sex === "F" && ageHours > DAM_MAX_BREED_AGE_HOURS) {
    return false;
  }

  return dog.lifecycleState === "ALIVE";
}

function getVisibleCategories(dog: DogForBreeding) {
  return deriveCurrentVisibleCategoriesForDogDisplay({
    storedTraits: dog,
    phenotypeHealthTruths: dog.healthConditionTruths,
    phenotypeHealthResults: dog.healthTests,
  });
}

function groupHealthConditionTruthsByDog(
  healthConditionTruths: BreedingHealthConditionTruth[]
) {
  const truthsByDogId = new Map<
    string,
    DogForBreeding["healthConditionTruths"]
  >();

  for (const truth of healthConditionTruths) {
    const truths = truthsByDogId.get(truth.dogId) ?? [];
    truths.push({
      conditionCode: truth.conditionCode,
      geneticLiability: truth.geneticLiability,
      environmentModifier: truth.environmentModifier,
    });
    truthsByDogId.set(truth.dogId, truths);
  }

  return truthsByDogId;
}

async function ensureAndLoadBreedingDisplayHealthTruths(dogIds: string[]) {
  const uniqueDogIds = [...new Set(dogIds)];

  if (uniqueDogIds.length === 0) {
    return new Map<string, DogForBreeding["healthConditionTruths"]>();
  }

  await ensurePhenotypeHealthTruthsForDogs(db, uniqueDogIds);

  const healthConditionTruths = await db.dogHealthConditionTruth.findMany({
    where: {
      dogId: {
        in: uniqueDogIds,
      },
      conditionCode: {
        in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES],
      },
    },
    select: {
      dogId: true,
      conditionCode: true,
      geneticLiability: true,
      environmentModifier: true,
    },
  });

  return groupHealthConditionTruthsByDog(healthConditionTruths);
}

function displayDogName(dog: {
  registeredName?: string | null;
  callName: string | null;
  regNumber: string;
  visibleTitlePrefix?: string | null;
  visibleTitleSuffix?: string | null;
}) {
  return formatDogDisplayName(dog);
}

function displayDogNameOrFallback(
  dog: {
    registeredName?: string | null;
    callName: string | null;
    regNumber: string;
    visibleTitlePrefix?: string | null;
    visibleTitleSuffix?: string | null;
  },
  fallback: string
) {
  if (!dog.registeredName?.trim() && !dog.callName?.trim()) {
    return fallback;
  }

  return displayDogName(dog);
}

function assertBreedingParticipationActive(dog: {
  isBreedingActive: boolean;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
}) {
  if (!dog.isBreedingActive) {
    throw new Error(`${displayDogName(dog)} is not currently active for breeding.`);
  }
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString()}`;
}

function hasOnlyGreenOrYellowRequiredPhenotypeHealthTests(
  tests: DogForBreeding["healthTests"],
  breedCode?: string | null
): boolean {
  const requiredCodes = new Set<string>(
    getRequiredHealthTestsForBreed(breedCode)
  );

  return (
    hasCompletedRequiredPhenotypeHealthTests(tests, breedCode) &&
    tests
      .filter((test) => requiredCodes.has(test.testTypeCode))
      .every(
        (test) =>
          getPhenotypeHealthSeverity(test.testTypeCode, test.resultCode) !==
          "red"
      )
  );
}

function isFinishedChampion(dog: {
  visibleTitlePrefix?: string | null;
  visibleTitleSuffix?: string | null;
}): boolean {
  return isChampionOfRecordDog(dog);
}

function assertDamMeetsStudListingRequirements(args: {
  dam: DogForBreeding;
  listing: {
    requiresDamHealthTestsCompleted: boolean;
    requiresDamHealthAllGreen: boolean;
    requiresDamHealthGreenOrYellow: boolean;
    requiresDamChampionTitle: boolean;
  };
}) {
  const { dam, listing } = args;

  if (
    listing.requiresDamHealthTestsCompleted &&
    !hasCompletedRequiredPhenotypeHealthTests(dam.healthTests, dam.breedCode2)
  ) {
    throw new Error(
      "This stud requires bitches to have all required health tests completed."
    );
  }

  if (
    listing.requiresDamHealthAllGreen &&
    !hasAllGreenRequiredPhenotypeHealthTests(dam.healthTests, dam.breedCode2)
  ) {
    throw new Error("This stud requires bitches to have all-green health test results.");
  }

  if (
    listing.requiresDamHealthGreenOrYellow &&
    !hasOnlyGreenOrYellowRequiredPhenotypeHealthTests(
      dam.healthTests,
      dam.breedCode2
    )
  ) {
    throw new Error("This stud requires bitches to have no red health test results.");
  }

  if (listing.requiresDamChampionTitle && !isFinishedChampion(dam)) {
    throw new Error("This stud requires bitches to be finished champions.");
  }
}

async function getDogForBreeding(dogId: string): Promise<DogForBreeding | null> {
  return db.dog.findUnique({
    where: { id: dogId },
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      breedCode2: true,
      sex: true,
      birthEpoch: true,
      lifecycleState: true,
      ownerKennelId: true,
      isBreedingActive: true,
      breed: {
        select: {
          name: true,
        },
      },
      traitHead: true,
      traitForequarters: true,
      traitHindquarters: true,
      traitGait: true,
      traitCoat: true,
      traitSize: true,
      traitTemperament: true,
      traitShowShine: true,
      traitFeet: true,
      traitTopline: true,
      healthTests: {
        where: {
          isPublic: true,
        },
        orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
        select: {
          testTypeCode: true,
          resultCode: true,
        },
      },
      healthConditionTruths: {
        where: {
          conditionCode: {
            in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES],
          },
        },
        select: {
          conditionCode: true,
          geneticLiability: true,
          environmentModifier: true,
        },
      },
    },
  });
}

async function resolvePregnancyCheckAttempt(args: {
  attemptId: string;
  currentEpoch: number;
}): Promise<PregnancyCheckResolutionOutcome> {
  const { attemptId, currentEpoch } = args;

  return db.$transaction(async (tx) => {
    const fresh = await tx.breedingAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        sireId: true,
        damId: true,
        breedCode2: true,
        createdEpoch: true,
        pregCheckEpoch: true,
        dueEpoch: true,
        checkedEpoch: true,
        whelpedEpoch: true,
        isPregnant: true,
        status: true,
        rngSeed: true,
        litterId: true,
        createdByKennelId: true,
        dam: {
          select: {
            id: true,
            registeredName: true,
            callName: true,
            regNumber: true,
            visibleTitlePrefix: true,
            visibleTitleSuffix: true,
          },
        },
      },
    });

    if (
      !fresh ||
      fresh.status !== "INITIATED" ||
      fresh.checkedEpoch !== null ||
      fresh.pregCheckEpoch === null ||
      fresh.dueEpoch === null
    ) {
      return { status: "SKIPPED", dueEpoch: null };
    }

    const rngSeed = requireRngSeed(fresh.rngSeed);
    const conceptionRoll = seeded01(`${rngSeed}:pregcheck`);

    const resolved = resolvePregnancyCheck({
      attempt: {
        attemptId: fresh.id,
        sireId: fresh.sireId,
        damId: fresh.damId,
        breedCode2: fresh.breedCode2,
        createdEpoch: fresh.createdEpoch,
        pregCheckEpoch: fresh.pregCheckEpoch,
        dueEpoch: fresh.dueEpoch,
        checkedEpoch: fresh.checkedEpoch,
        whelpedEpoch: fresh.whelpedEpoch,
        isPregnant: fresh.isPregnant,
        status: fresh.status,
        litterId: fresh.litterId ?? null,
        rngSeed,
      },
      currentEpoch,
      conceptionRate: 0.75,
      conceptionRoll,
    });

    await tx.breedingAttempt.update({
      where: { id: fresh.id },
      data: {
        status: resolved.status,
        checkedEpoch: resolved.checkedEpoch,
        isPregnant: resolved.isPregnant,
      },
    });

    if (resolved.status === "CHECKED_NOT_PREGNANT") {
      const contract = await tx.studContract.findFirst({
        where: { breedingAttemptId: fresh.id, status: "ACCEPTED", noLitterReturnService: true },
        select: { id: true },
      });
      if (contract) {
        await createStudContractReturnService({
          client: tx,
          contractId: contract.id,
          trigger: "NO_LITTER",
          availableAt: new Date(),
        });
      }
    }

    if (resolved.status === "CHECKED_NOT_PREGNANT" && fresh.createdByKennelId) {
      await createKennelNotice({
        client: tx,
        kennelId: fresh.createdByKennelId,
        type: "DID_NOT_TAKE",
        title: "Female did not take",
        body: `${formatDogDisplayName(fresh.dam)} did not take on this breeding.`,
        currentEpoch,
        linkedDogId: fresh.dam.id,
      });
    }

    if (resolved.status === "PREGNANT") {
      return {
        status: "PREGNANT",
        dueEpoch: fresh.dueEpoch,
      };
    }

    return {
      status: "CHECKED_NOT_PREGNANT",
      dueEpoch: null,
    };
  });
}

async function resolveWhelpingAttempt(args: {
  attemptId: string;
  currentEpoch: number;
}): Promise<WhelpingResolutionOutcome> {
  const { attemptId, currentEpoch } = args;

  return db.$transaction(async (tx) => {
    const fresh = await tx.breedingAttempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        sireId: true,
        damId: true,
        breedCode2: true,
        createdEpoch: true,
        pregCheckEpoch: true,
        dueEpoch: true,
        checkedEpoch: true,
        whelpedEpoch: true,
        isPregnant: true,
        status: true,
        rngSeed: true,
        litterId: true,
        createdByKennelId: true,
        sire: {
          select: {
            id: true,
            traitHead: true,
            traitForequarters: true,
            traitHindquarters: true,
            traitGait: true,
            traitCoat: true,
            traitSize: true,
            traitTemperament: true,
            traitShowShine: true,
            traitFeet: true,
            traitTopline: true,
            genotype: true,
            geneticsVersion: true,
          },
        },
        dam: {
          select: {
            id: true,
            ownerKennelId: true,
            kennelRunId: true,
            registeredName: true,
            callName: true,
            regNumber: true,
            visibleTitlePrefix: true,
            visibleTitleSuffix: true,
            traitHead: true,
            traitForequarters: true,
            traitHindquarters: true,
            traitGait: true,
            traitCoat: true,
            traitSize: true,
            traitTemperament: true,
            traitShowShine: true,
            traitFeet: true,
            traitTopline: true,
            genotype: true,
            geneticsVersion: true,
          },
        },
      },
    });

    if (
      !fresh ||
      fresh.status !== "PREGNANT" ||
      fresh.isPregnant !== true ||
      fresh.dueEpoch === null ||
      fresh.whelpedEpoch !== null ||
      fresh.litterId !== null
    ) {
      return "SKIPPED";
    }

    {
      const existingEmergency = await tx.reproductiveEmergencyEvent.findUnique({
        where: {
          breedingAttemptId: fresh.id,
        },
        select: {
          id: true,
        },
      });

      if (existingEmergency) {
        return "SKIPPED";
      }
    }

    const rngSeed = requireRngSeed(fresh.rngSeed);
    let pupCountNoiseIndex = 0;
    const pupCount = rollLitterSize(() => {
      const value = seeded01(`${rngSeed}:pup-count:${pupCountNoiseIndex}`);
      pupCountNoiseIndex += 1;
      return value;
    });

    {
      const trigger = shouldTriggerReproductiveEmergency({
        rngSeed,
        rulesetVersion: REPRODUCTIVE_EMERGENCY_RULESET_VERSION,
      });

      if (trigger.triggered) {
        try {
          const emergency = await tx.reproductiveEmergencyEvent.create({
            data: {
              breedingAttemptId: fresh.id,
              damId: fresh.damId,
              kennelIdAtEvent: fresh.createdByKennelId,
              type: "WHELPING_COMPLICATION",
              status: "PENDING",
              sourceKey: getReproductiveEmergencySourceKey(fresh.id),
              createdAtEpoch: currentEpoch,
              responseDeadlineEpoch:
                currentEpoch + REPRODUCTIVE_EMERGENCY_RESPONSE_WINDOW_HOURS,
              treatmentCost: REPRODUCTIVE_EMERGENCY_TREATMENT_COST,
              intendedPuppyCount: pupCount,
              rulesetVersion: trigger.rulesetVersion,
              rngSeed,
              triggerRoll: trigger.triggerRoll,
              outcomeMetadataJson: {
                triggerRate: trigger.triggerRate,
                triggerRoll: trigger.triggerRoll,
                rulesetVersion: trigger.rulesetVersion,
                intendedPuppyCount: pupCount,
              },
            },
          });
          const transition = await tx.breedingAttempt.updateMany({
            where: {
              id: fresh.id,
              status: "PREGNANT",
              isPregnant: true,
              whelpedEpoch: null,
              litterId: null,
            },
            data: {
              status: "REPRODUCTIVE_EMERGENCY",
            },
          });

          if (transition.count !== 1) {
            throw new Error(
              "Breeding attempt changed before reproductive emergency transition."
            );
          }

          await createReproductiveEmergencyNotice({
            client: tx,
            kennelId: fresh.createdByKennelId,
            breedingAttemptId: fresh.id,
            damId: fresh.damId,
            currentEpoch,
          });

          console.info("reproductive emergency created", {
            reproductiveEmergencyEventId: emergency.id,
            breedingAttemptId: fresh.id,
            damId: fresh.damId,
            intendedPuppyCount: pupCount,
            triggerRoll: trigger.triggerRoll,
            triggerRate: trigger.triggerRate,
            rulesetVersion: trigger.rulesetVersion,
            responseDeadlineEpoch: emergency.responseDeadlineEpoch,
          });

          return "REPRODUCTIVE_EMERGENCY";
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            return "SKIPPED";
          }

          throw error;
        }
      }
    }

    const puppyDogIds = Array.from({ length: pupCount }, () => randomUUID());
    const puppySexes = buildPuppySexes(String(rngSeed), pupCount);
    const pedigree = await loadPedigreeForCoi(tx, [
      fresh.sireId,
      fresh.damId,
    ]);
    const pairingCoi = calculatePedigreeCoi({
      sireId: fresh.sireId,
      damId: fresh.damId,
      pedigree,
    });
    let noiseIndex = 0;

    const litterId = randomUUID();
    const outcome = resolveWhelp({
      attempt: {
        attemptId: fresh.id,
        sireId: fresh.sireId,
        damId: fresh.damId,
        breedCode2: fresh.breedCode2,
        createdEpoch: fresh.createdEpoch,
        pregCheckEpoch: fresh.pregCheckEpoch ?? 0,
        dueEpoch: fresh.dueEpoch,
        checkedEpoch: fresh.checkedEpoch,
        whelpedEpoch: fresh.whelpedEpoch,
        isPregnant: fresh.isPregnant,
        litterId: fresh.litterId,
        status: fresh.status,
        rngSeed,
      },
      currentEpoch,
      litterId,
      pupCount,
      puppyDogIds,
      puppySexes,
      sireTraits: mapBreedingTraits(fresh.sire),
      damTraits: mapBreedingTraits(fresh.dam),
      sireGenotype: fresh.sire.genotype ?? (() => { throw new Error(`GEN-08 integrity failure: breeding attempt ${fresh.id} sire ${fresh.sireId} is missing genotype.`); })(),
      sireGeneticsVersion: fresh.sire.geneticsVersion ?? (() => { throw new Error(`GEN-08 integrity failure: breeding attempt ${fresh.id} sire ${fresh.sireId} is missing geneticsVersion.`); })(),
      damGenotype: fresh.dam.genotype ?? (() => { throw new Error(`GEN-08 integrity failure: breeding attempt ${fresh.id} dam ${fresh.damId} is missing genotype.`); })(),
      damGeneticsVersion: fresh.dam.geneticsVersion ?? (() => { throw new Error(`GEN-08 integrity failure: breeding attempt ${fresh.id} dam ${fresh.damId} is missing geneticsVersion.`); })(),
      coiPercent: pairingCoi.coiPercent,
      coiGenerationDepth: pairingCoi.generationDepth,
      random01: () => {
        const value = seeded01(`${rngSeed}:whelp:${noiseIndex}`);
        noiseIndex += 1;
        return value;
      },
      puppyGeneticsRandom01: createPuppyGeneticsRandom01ForLitter({
        breedingAttemptId: fresh.id, litterId, geneticsSeed: rngSeed,
        sire: { id: fresh.sireId, traits: mapBreedingTraits(fresh.sire), genotype: fresh.sire.genotype, geneticsVersion: fresh.sire.geneticsVersion },
        dam: { id: fresh.damId, traits: mapBreedingTraits(fresh.dam), genotype: fresh.dam.genotype, geneticsVersion: fresh.dam.geneticsVersion },
        coiPercent: pairingCoi.coiPercent,
      }),
    });

    const persistedLitter = await createLitterWithCollisionRetry({
      client: tx,
      litter: {
        id: outcome.litter.litterId,
        bredByKennelId: fresh.createdByKennelId,
        sireId: outcome.litter.sireId,
        damId: outcome.litter.damId,
        breedCode2: outcome.litter.breedCode2,
        serial7: outcome.litter.serial7,
        bornEpoch: outcome.litter.bornEpoch,
        pupCount: outcome.litter.pupCount,
      },
      puppies: outcome.puppies,
    });

    const litterRun =
      fresh.createdByKennelId && persistedLitter.puppies.length > 0
        ? await ensureLitterKennelRun({
            client: tx,
            kennelId: fresh.createdByKennelId,
            litterId: outcome.litter.litterId,
            breedCode2: outcome.litter.breedCode2,
            serial7: persistedLitter.serial7,
          })
        : null;

    await tx.dog.createMany({
      data: persistedLitter.puppies.map((puppy) => ({
        id: puppy.dogId,
        ownerKennelId: fresh.createdByKennelId,
        kennelRunId: litterRun?.id ?? null,
        breederKennelId: fresh.createdByKennelId,
        callName: null,
        registeredName: null,
        regNumber: puppy.regNumber,
        breedCode2: puppy.breedCode2,
        sex: puppy.sex,
        birthEpoch: puppy.birthEpoch,
        lifecycleState: "ALIVE",
        marketState: "NOT_FOR_SALE",
        originType: "PLAYER_BRED",
        isFoundation: false,
        sireId: puppy.sireId,
        damId: puppy.damId,
        litterId: puppy.litterId,
        litterOrder: puppy.litterOrder,
        coiPercent: outcome.litter.coiPercent,
        coiGenerationDepth: outcome.litter.coiGenerationDepth,
        genotype: puppy.genotype,
        geneticsVersion: puppy.geneticsVersion,
        ...toPersistedDogTraits(puppy.traits),
      })),
    });

    await ensurePhenotypeHealthTruthsForDogs(
      tx,
      outcome.puppies.map((puppy) => puppy.dogId)
    );

    await infectPuppiesFromDamBrucellosis(tx, {
      damId: fresh.damId,
      puppyDogIds: outcome.puppies.map((puppy) => puppy.dogId),
      currentEpoch,
      breedingAttemptId: fresh.id,
    });

    const acceptedContract = await tx.studContract.findFirst({
      where: { breedingAttemptId: fresh.id, status: "ACCEPTED", litterId: null },
      select: { id: true, compensationType: true, minimumLitterSize: true, smallLitterReturnThreshold: true, puppyPickPosition: true },
    });
    if (acceptedContract) {
      const qualification = evaluateStudContractWhelpQualification({
        compensationType: acceptedContract.compensationType,
        minimumLitterSize: acceptedContract.minimumLitterSize,
        smallLitterReturnThreshold: acceptedContract.smallLitterReturnThreshold,
        liveBornPuppyCount: persistedLitter.puppies.length,
      });
      const whelpQualificationAt = new Date();
      const qualificationUpdate = await tx.studContract.updateMany({
        where: { id: acceptedContract.id, status: "ACCEPTED", litterId: null, whelpQualificationAt: null },
        data: { litterId: persistedLitter.id, whelpQualificationAt, liveBornPuppyCount: persistedLitter.puppies.length, ...qualification },
      });
      if (qualificationUpdate.count === 1 && qualification.smallLitterReturnServiceMet === true) {
        await createStudContractReturnService({
          client: tx,
          contractId: acceptedContract.id,
          trigger: "SMALL_LITTER",
          availableAt: whelpQualificationAt,
        });
      }
      if (qualificationUpdate.count === 1 && qualification.puppyBackMinimumMet === true && acceptedContract.puppyPickPosition) {
        await openInitialStudContractPuppySelection({
          client: tx,
          contractId: acceptedContract.id,
          litterId: persistedLitter.id,
          puppyPickPosition: acceptedContract.puppyPickPosition,
          bornEpoch: outcome.litter.bornEpoch,
          turnStartedAt: new Date(),
        });
      }
    }

    await tx.breedingAttempt.update({
      where: { id: fresh.id },
      data: {
        status: "WHELPED",
        whelpedEpoch: currentEpoch,
        litterId: outcome.litter.litterId,
      },
    });

    if (fresh.createdByKennelId) {
      await createKennelNotice({
        client: tx,
        kennelId: fresh.createdByKennelId,
        type: "LITTER_BORN",
        title: "Litter born",
        body: `Litter ${persistedLitter.serial7} has been born with ${outcome.litter.pupCount} puppies.`,
        currentEpoch,
        linkedLitterId: outcome.litter.litterId,
        linkedDogId: outcome.litter.damId,
      });
    }

    return "WHELPED";
  });
}

async function resolveDueBreedingProgress(args: {
  currentEpoch: number;
  kennelId?: string;
  damId?: string;
  limit?: number;
  continueOnError?: boolean;
}): Promise<BreedingProgressResolutionSummary> {
  const { currentEpoch, kennelId, damId, limit, continueOnError = false } = args;
  const where: Prisma.BreedingAttemptWhereInput = {
    ...(kennelId ? { createdByKennelId: kennelId } : {}),
    ...(damId ? { damId } : {}),
    OR: [
      {
        status: "INITIATED",
        pregCheckEpoch: {
          not: null,
          lte: currentEpoch,
        },
      },
      {
        status: "PREGNANT",
        dueEpoch: {
          not: null,
          lte: currentEpoch,
        },
      },
    ],
  };
  const dueAttempts: DueAttemptForResolution[] =
    await db.breedingAttempt.findMany({
      where,
      orderBy: [{ createdEpoch: "asc" }],
      ...(limit ? { take: limit } : {}),
      select: {
        id: true,
        status: true,
        pregCheckEpoch: true,
        dueEpoch: true,
      },
    });
  const summary = createBreedingProgressResolutionSummary();

  for (const attempt of dueAttempts) {
    try {
      let whelpedThisAttempt = false;

      if (
        attempt.status === "INITIATED" &&
        attempt.pregCheckEpoch !== null &&
        attempt.pregCheckEpoch <= currentEpoch
      ) {
        const pregnancyOutcome = await resolvePregnancyCheckAttempt({
          attemptId: attempt.id,
          currentEpoch,
        });

        if (pregnancyOutcome.status === "SKIPPED") {
          summary.skippedCount += 1;
        } else {
          summary.checkedCount += 1;

          if (pregnancyOutcome.status === "PREGNANT") {
            summary.becamePregnantCount += 1;

            if (
              pregnancyOutcome.dueEpoch !== null &&
              pregnancyOutcome.dueEpoch <= currentEpoch
            ) {
              const whelpOutcome = await resolveWhelpingAttempt({
                attemptId: attempt.id,
                currentEpoch,
              });

              if (whelpOutcome === "WHELPED") {
                summary.whelpedCount += 1;
                whelpedThisAttempt = true;
              } else {
                summary.skippedCount += 1;
              }
            }
          } else {
            summary.didNotTakeCount += 1;
          }
        }
      }

      if (
        !whelpedThisAttempt &&
        attempt.status === "PREGNANT" &&
        attempt.dueEpoch !== null &&
        attempt.dueEpoch <= currentEpoch
      ) {
        const whelpOutcome = await resolveWhelpingAttempt({
          attemptId: attempt.id,
          currentEpoch,
        });

        if (whelpOutcome === "WHELPED") {
          summary.whelpedCount += 1;
        } else {
          summary.skippedCount += 1;
        }
      }
    } catch (error) {
      summary.failedCount += 1;

      if (!continueOnError) {
        throw error;
      }

      console.error("Breeding progress resolution failed", {
        attemptId: attempt.id,
        status: attempt.status,
        error,
      });
    }
  }

  return summary;
}

export async function resolveBreedingProgressForKennel(args: {
  kennelId: string;
  currentEpoch: number;
}): Promise<BreedingProgressResolutionSummary> {
  const { kennelId, currentEpoch } = args;

  return resolveDueBreedingProgress({ kennelId, currentEpoch });
}

export async function resolveDueBreedingProgressForKennel(args: {
  kennelId: string;
  currentEpoch: number;
}): Promise<BreedingProgressResolutionSummary> {
  return resolveDueBreedingProgress({
    kennelId: args.kennelId,
    currentEpoch: args.currentEpoch,
  });
}

export async function resolveBreedingProgressForOwnedDam(args: {
  kennelId: string;
  dogId: string;
  currentEpoch: number;
}): Promise<BreedingProgressResolutionSummary> {
  const { kennelId, dogId, currentEpoch } = args;
  const dog = await db.dog.findUnique({
    where: { id: dogId },
    select: {
      ownerKennelId: true,
      sex: true,
    },
  });

  if (!dog || dog.ownerKennelId !== kennelId || dog.sex !== "F") {
    return createBreedingProgressResolutionSummary();
  }

  return resolveDueBreedingProgress({ kennelId, damId: dogId, currentEpoch });
}

export async function resolveDueBreedingProgressBatch(args: {
  currentEpoch: number;
  limit: number;
}): Promise<BreedingProgressResolutionSummary> {
  return resolveDueBreedingProgress({
    currentEpoch: args.currentEpoch,
    limit: args.limit,
    continueOnError: true,
  });
}

type ListBreedingsForKennelArgs = {
  kennelId: string;
  currentEpoch: number;
  dogId?: string;
};

async function listBreedingsForKennelSummaries(
  args: ListBreedingsForKennelArgs
) {
  const { kennelId, currentEpoch, dogId } = args;

  const attempts = await db.breedingAttempt.findMany({
    where: {
      createdByKennelId: kennelId,
      status: {
        in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"],
      },
      ...(dogId
        ? {
            OR: [{ sireId: dogId }, { damId: dogId }],
          }
        : {}),
    },
    orderBy: [{ createdEpoch: "desc" }],
    select: {
      id: true,
      sireId: true,
      damId: true,
      breedCode2: true,
      createdEpoch: true,
      pregCheckEpoch: true,
      dueEpoch: true,
      checkedEpoch: true,
      isPregnant: true,
      status: true,
      sire: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
        },
      },
      dam: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
        },
      },
      reproductiveEmergency: {
        select: {
          status: true,
        },
      },
    },
  });

  return attempts.map((attempt) => ({
    id: attempt.id,
    sireId: attempt.sireId,
    damId: attempt.damId,
    breedCode2: attempt.breedCode2,
    createdEpoch: attempt.createdEpoch,
    pregCheckEpoch: attempt.pregCheckEpoch,
    dueEpoch: attempt.dueEpoch,
    checkedEpoch: attempt.checkedEpoch,
    isPregnant: attempt.isPregnant,
    status: attempt.status,
    reproductiveEmergencyStatus: attempt.reproductiveEmergency?.status ?? null,
    sireName: displayDogName(attempt.sire),
    damName: displayDogName(attempt.dam),
    hoursUntilPregCheck:
      attempt.pregCheckEpoch !== null
        ? Math.max(0, attempt.pregCheckEpoch - currentEpoch)
        : null,
    hoursUntilDue:
      attempt.dueEpoch !== null ? Math.max(0, attempt.dueEpoch - currentEpoch) : null,
  }));
}

export async function listBreedingsForKennelAfterProgressResolved(
  args: ListBreedingsForKennelArgs
) {
  return listBreedingsForKennelSummaries(args);
}

export async function listBreedingsForKennel(args: ListBreedingsForKennelArgs) {
  const { kennelId, currentEpoch } = args;

  await resolveBreedingProgressForKennel({ kennelId, currentEpoch });

  return listBreedingsForKennelSummaries(args);
}

export async function createBreedingAttemptForKennel(args: {
  kennelId: string;
  primaryDogId: string;
  mateDogId: string;
  studListingId?: string;
  currentEpoch: number;
  testDamBrucellosis?: boolean;
  testSireBrucellosis?: boolean;
  automaticStudContract?: boolean;
  publicStudSource?: "STUD_OFFER" | "LEGACY_PLAYER_STUD";
  manualApprovedContractId?: string;
  returnServiceId?: string;
}) {
  const {
    kennelId,
    primaryDogId,
    mateDogId,
    studListingId,
    currentEpoch,
  } = args;

  const [primaryDog, mateDog] = await Promise.all([
    getDogForBreeding(primaryDogId),
    getDogForBreeding(mateDogId),
  ]);

  if (!primaryDog || !mateDog) {
    throw new Error("One or both dogs could not be found.");
  }

  if (primaryDog.id === mateDog.id) {
    throw new Error("A dog cannot be bred to itself.");
  }

  assertBreedingParticipationActive(primaryDog);
  assertBreedingParticipationActive(mateDog);

  if (primaryDog.lifecycleState !== "ALIVE" || mateDog.lifecycleState !== "ALIVE") {
    throw new Error("Only living dogs may be bred.");
  }

  if (primaryDog.breedCode2 !== mateDog.breedCode2) {
    throw new Error("Only same-breed pairings are allowed in this beta.");
  }

  if (primaryDog.sex === mateDog.sex) {
    throw new Error("Breeding requires one male and one female.");
  }

  if (!isBreedAgeEligible(primaryDog, currentEpoch)) {
    throw new Error(
      `${displayDogName(primaryDog)} is not breeding eligible.`
    );
  }

  if (!isBreedAgeEligible(mateDog, currentEpoch)) {
    throw new Error(
      `${displayDogName(mateDog)} is not breeding eligible.`
    );
  }

  const sire = primaryDog.sex === "M" ? primaryDog : mateDog;
  const dam = primaryDog.sex === "F" ? primaryDog : mateDog;
  const usesPublicStud = sire.ownerKennelId !== kennelId;
  const isReturnServiceAttempt = Boolean(args.returnServiceId);

  if (dam.ownerKennelId !== kennelId) {
    throw new Error("You may only breed dams owned by your kennel.");
  }

  if (
    usesPublicStud &&
    !studListingId &&
    !isReturnServiceAttempt &&
    !(args.automaticStudContract && args.publicStudSource === "STUD_OFFER") &&
    !args.manualApprovedContractId
  ) {
    throw new Error("Choose an active public stud listing for that sire.");
  }

  if (!usesPublicStud && studListingId) {
    throw new Error("Stud listings are only needed for sires outside your kennel.");
  }

  const conflictingAttempt = await db.breedingAttempt.findFirst({
    where: {
      damId: dam.id,
      status: {
        in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"],
      },
    },
    select: {
      id: true,
    },
  });

  if (conflictingAttempt) {
    throw new Error("That dam already has an active breeding in progress.");
  }

  const pendingStudApproval = await db.studContract.findFirst({
    where: { damDogId: dam.id, status: "PENDING", ...(args.manualApprovedContractId ? { id: { not: args.manualApprovedContractId } } : {}) },
    select: { id: true },
  });
  if (pendingStudApproval) {
    throw new Error("This dam has a Stud approval pending.");
  }

  const resolvedReproductiveEmergencies = await db.reproductiveEmergencyEvent.findMany({
    where: { damId: dam.id, status: { in: ["RESOLVED_TREATED", "RESOLVED_UNTREATED"] } },
    select: { id: true, status: true, resolvedEpoch: true, reproductiveConsequence: true },
  });

  const latestWhelpedAttempt = await db.breedingAttempt.findFirst({
    where: {
      damId: dam.id,
      status: "WHELPED",
      whelpedEpoch: {
        not: null,
      },
    },
    orderBy: {
      whelpedEpoch: "desc",
    },
    select: {
      whelpedEpoch: true,
    },
  });
  const damCooldownUntil =
    latestWhelpedAttempt?.whelpedEpoch == null
      ? null
      : latestWhelpedAttempt.whelpedEpoch + WHELPING_COOLDOWN_HOURS;
  const damEligibility = getIndividualBreedingEligibility({ currentEpoch, birthEpoch: dam.birthEpoch, lifecycleState: "ALIVE", sex: dam.sex, lastWhelpedEpoch: latestWhelpedAttempt?.whelpedEpoch ?? null, resolvedReproductiveEmergencies });
  if (!damEligibility.isEligible) throw new Error(getBreedingEligibilityMessage(damEligibility) ?? `${displayDogName(dam)} is not breeding eligible.`);

  const rngSeed = Math.floor(Math.random() * 1_000_000);
  let timingNoiseIndex = 0;
  const timing = rollBreedingTiming(() => {
    const value = seeded01(`${rngSeed}:timing:${timingNoiseIndex}`);
    timingNoiseIndex += 1;
    return value;
  });

  const attempt = await db.$transaction(async (tx) => {
    let studFeeAmount = 0;
    let studSellerKennelId: string | null = null;
    let studSellerBalanceAfter: number | null = null;
    let requiresBrucellosisNegativeDam = false;
    let returnServiceContract: Prisma.StudContractGetPayload<{
      include: { healthRequirements: true };
    }> | null = null;

    if (args.returnServiceId) {
      await tx.$queryRaw`SELECT "id" FROM "StudContractReturnService" WHERE "id" = ${args.returnServiceId} FOR UPDATE`;
      const returnService = await tx.studContractReturnService.findUnique({
        where: { id: args.returnServiceId },
        include: { contract: { include: { healthRequirements: true } } },
      });
      if (!returnService) throw new Error("Return Service not found.");
      if (returnService.status === "USED") throw new Error("This Return Service has already been used.");
      if (returnService.status === "EXPIRED") throw new Error("This Return Service has expired.");
      if (returnService.status === "EXTINGUISHED") {
        if (returnService.extinguishmentReason === "SIRE_OWNERSHIP_CHANGED") throw new Error("This Return Service ended because the sire changed kennels.");
        if (returnService.extinguishmentReason === "DAM_OWNERSHIP_CHANGED") throw new Error("This Return Service ended because the dam changed kennels.");
        if (returnService.extinguishmentReason === "SIRE_DIED") throw new Error("This Return Service ended because the sire died.");
        if (returnService.extinguishmentReason === "DAM_DIED") throw new Error("This Return Service ended because the dam died.");
        if (returnService.extinguishmentReason === "PERMANENT_BREEDING_INELIGIBILITY") throw new Error("This Return Service ended because a required dog is permanently ineligible for breeding.");
        throw new Error("This Return Service is no longer available.");
      }
      if (returnService.expiresAt <= new Date()) {
        await tx.studContractReturnService.updateMany({
          where: { id: returnService.id, status: "AVAILABLE", expiresAt: { lte: new Date() } },
          data: { status: "EXPIRED" },
        });
        throw new Error("This Return Service has expired.");
      }
      if (returnService.contract.status !== "ACCEPTED" || returnService.contract.damKennelId !== kennelId) {
        throw new Error("Only the original dam-owning kennel may use this Return Service.");
      }
      if (returnService.contract.sireDogId !== sire.id || returnService.contract.damDogId !== dam.id) {
        throw new Error("Return Service dog identity no longer matches the original contract.");
      }
      returnServiceContract = returnService.contract;
    }

    if (args.automaticStudContract || isReturnServiceAttempt || args.manualApprovedContractId) {
      await tx.$queryRaw`
        SELECT "id"
        FROM "Dog"
        WHERE "id" = ${dam.id}
        FOR UPDATE
      `;
      const freshDamConflict = await tx.breedingAttempt.findFirst({
        where: {
          damId: dam.id,
          status: {
            in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"],
          },
        },
        select: { id: true },
      });
      if (freshDamConflict) {
        throw new Error("That dam already has an active breeding in progress.");
      }
      const freshDam = await tx.dog.findUnique({
        where: { id: dam.id },
        select: {
          ownerKennelId: true,
          breedCode2: true,
          sex: true,
          lifecycleState: true,
          birthEpoch: true,
          isBreedingActive: true,
        },
      });
      if (
        !freshDam ||
        freshDam.ownerKennelId !== (returnServiceContract?.damKennelId ?? kennelId) ||
        freshDam.breedCode2 !== sire.breedCode2 ||
        freshDam.sex !== "F" ||
        freshDam.lifecycleState !== "ALIVE" ||
        !freshDam.isBreedingActive ||
        !isBreedAgeEligible({ ...dam, ...freshDam }, currentEpoch)
      ) {
        throw new Error("This dam is no longer eligible to breed.");
      }
      if (isReturnServiceAttempt || args.manualApprovedContractId) {
        const [freshDamEmergencyEvents, freshDamWhelpedAttempt] = await Promise.all([
          tx.reproductiveEmergencyEvent.findMany({
            where: { damId: dam.id, status: { in: ["RESOLVED_TREATED", "RESOLVED_UNTREATED"] } },
            select: { id: true, status: true, resolvedEpoch: true, reproductiveConsequence: true },
          }),
          tx.breedingAttempt.findFirst({
            where: { damId: dam.id, status: "WHELPED", whelpedEpoch: { not: null } },
            orderBy: { whelpedEpoch: "desc" },
            select: { whelpedEpoch: true },
          }),
        ]);
        const freshDamEligibility = getIndividualBreedingEligibility({
          currentEpoch,
          birthEpoch: freshDam.birthEpoch,
          lifecycleState: freshDam.lifecycleState,
          sex: freshDam.sex,
          lastWhelpedEpoch: freshDamWhelpedAttempt?.whelpedEpoch ?? null,
          resolvedReproductiveEmergencies: freshDamEmergencyEvents,
        });
        if (!freshDamEligibility.isEligible) {
          throw new Error(getBreedingEligibilityMessage(freshDamEligibility) ?? "This dam is no longer eligible to breed.");
        }
      }
    }

    await tx.$queryRaw`
      SELECT "id"
      FROM "Dog"
      WHERE "id" = ${sire.id}
      FOR UPDATE
    `;

    const freshSire = await tx.dog.findUnique({
      where: { id: sire.id },
      select: {
        isBreedingActive: true,
        ownerKennelId: true,
        lifecycleState: true,
        breedCode2: true,
        sex: true,
        birthEpoch: true,
        callName: true,
        registeredName: true,
        regNumber: true,
      },
    });

    if (!freshSire) {
      throw new Error("Stud is no longer available.");
    }

    assertBreedingParticipationActive(freshSire);

    if (returnServiceContract && (
      freshSire.ownerKennelId !== returnServiceContract.sireKennelId ||
      freshSire.lifecycleState !== "ALIVE" ||
      freshSire.sex !== "M" ||
      freshSire.breedCode2 !== dam.breedCode2 ||
      !isBreedAgeEligible({ ...sire, ...freshSire }, currentEpoch)
    )) {
      throw new Error("The original sire is no longer eligible for this Return Service.");
    }

    const latestSireAttempt = await tx.breedingAttempt.findFirst({
      where: { sireId: sire.id },
      orderBy: [{ createdEpoch: "desc" }, { id: "desc" }],
      select: { createdEpoch: true },
    });
    const sireEligibility = getIndividualBreedingEligibility({
      currentEpoch,
      birthEpoch: sire.birthEpoch,
      lifecycleState: sire.lifecycleState as "ALIVE" | "RETIRED" | "DECEASED" | "TRANSFERRED",
      sex: sire.sex,
      latestSireAttemptCreatedEpoch: latestSireAttempt?.createdEpoch ?? null,
    });

    if (!sireEligibility.isEligible) {
      throw new Error(
        getBreedingEligibilityMessage(sireEligibility) ??
          `${displayDogName(sire)} is not breeding eligible.`
      );
    }

    await assertDogHasNoPendingVeterinaryCare(dam.id, tx);
    await assertDogHasNoPendingVeterinaryCare(sire.id, tx);

    const automaticOffer = args.automaticStudContract
      ? await tx.studOffer.findFirst({
          where: { sireDogId: sire.id, status: "PUBLISHED" },
          include: { healthRequirements: true },
        })
      : null;
    if (args.manualApprovedContractId) {
      await tx.$queryRaw`SELECT "id" FROM "StudContract" WHERE "id" = ${args.manualApprovedContractId} FOR UPDATE`;
    }
    const manualContract = args.manualApprovedContractId
      ? await tx.studContract.findFirst({
          where: { id: args.manualApprovedContractId, status: "PENDING" },
          include: { healthRequirements: true },
        })
      : null;

    if (returnServiceContract) {
      await assertDamMeetsStudContractRequirements({
        client: tx,
        damDogId: dam.id,
        currentEpoch,
        requirements: {
          brucellosisNegativeRequired: returnServiceContract.brucellosisNegativeRequired,
          healthRequirements: returnServiceContract.healthRequirements,
          titleRequirement: returnServiceContract.titleRequirement,
        },
      });
    } else if (usesPublicStud) {
      if (args.manualApprovedContractId) {
        if (
          !manualContract ||
          manualContract.sireDogId !== sire.id ||
          manualContract.damDogId !== dam.id ||
          manualContract.damKennelId !== kennelId
        ) {
          throw new Error("This Stud approval request is no longer pending.");
        }
        if (!manualContract.approvalDeadlineAt || new Date() >= manualContract.approvalDeadlineAt) {
          throw new Error("This Stud approval request deadline has passed.");
        }
        if (manualContract.approvalMode !== "MANUAL") {
          throw new Error("This Stud approval request is not a Manual Approval contract.");
        }
        if (
          freshSire.ownerKennelId !== manualContract.sireKennelId ||
          freshSire.lifecycleState !== "ALIVE" ||
          freshSire.sex !== "M" ||
          freshSire.breedCode2 !== dam.breedCode2
        ) {
          throw new Error("The original sire is no longer eligible for this Stud approval request.");
        }
        await assertDamMeetsStudContractRequirements({
          client: tx,
          damDogId: dam.id,
          currentEpoch,
          requirements: {
            brucellosisNegativeRequired: manualContract.brucellosisNegativeRequired,
            healthRequirements: manualContract.healthRequirements,
            titleRequirement: manualContract.titleRequirement,
          },
        });
        studFeeAmount =
          manualContract.compensationType === "PUPPY_BACK"
            ? 0
            : manualContract.cashAmount ?? 0;
        studSellerKennelId = manualContract.sireKennelId;
      } else if (args.automaticStudContract && args.publicStudSource === "STUD_OFFER") {
        if (!automaticOffer) {
          throw new Error("This Stud Offer is no longer published.");
        }
        if (
          automaticOffer.ownerKennelId !== freshSire.ownerKennelId ||
          freshSire.ownerKennelId === kennelId ||
          freshSire.lifecycleState !== "ALIVE" ||
          freshSire.sex !== "M"
        ) {
          throw new Error("This Stud Offer is no longer available.");
        }
        if (automaticOffer.approvalMode !== "AUTOMATIC") {
          throw new Error("This Stud Offer requires Manual Approval.");
        }
        await assertDamMeetsStudContractRequirements({
          client: tx,
          damDogId: dam.id,
          currentEpoch,
          requirements: {
            brucellosisNegativeRequired: automaticOffer.brucellosisNegativeRequired,
            healthRequirements: automaticOffer.healthRequirements,
            titleRequirement: automaticOffer.titleRequirement,
          },
        });
        studFeeAmount =
          automaticOffer.compensationType === "PUPPY_BACK"
            ? 0
            : automaticOffer.cashAmount ?? 0;
        studSellerKennelId = automaticOffer.ownerKennelId;
      } else {
      const studListing = await tx.dogListing.findFirst({
        where: { id: studListingId, ...activePublicStudListingWhere({ dogId: sire.id }) },
        select: {
          id: true,
          askingPrice: true,
          sellerKennelId: true,
          requiresBrucellosisNegativeDam: true,
          requiresDamHealthTestsCompleted: true,
          requiresDamHealthAllGreen: true,
          requiresDamHealthGreenOrYellow: true,
          requiresDamChampionTitle: true,
          dog: {
            select: {
              id: true,
              ownerKennelId: true,
              breedCode2: true,
              lifecycleState: true,
              sex: true,
            },
          },
        },
      });

      if (!studListing || !studListing.sellerKennelId) {
        throw new Error("Public stud listing not found.");
      }
      const publicStud = adaptLegacyPublicStudListing(studListing);
      if (!publicStud || publicStud.legacyListingId !== studListingId || publicStud.sireDogId !== sire.id) {
        throw new Error("Public stud listing not found.");
      }

      if (studListing.sellerKennelId === kennelId) {
        throw new Error("You already own that stud.");
      }

      if (
        studListing.dog.ownerKennelId !== studListing.sellerKennelId ||
        studListing.dog.lifecycleState !== "ALIVE" ||
        studListing.dog.sex !== "M"
      ) {
        throw new Error("That stud is no longer available.");
      }

      studFeeAmount = studListing.askingPrice;
      studSellerKennelId = studListing.sellerKennelId;
      requiresBrucellosisNegativeDam =
        studListing.requiresBrucellosisNegativeDam;
      if (args.automaticStudContract) {
        if (!automaticOffer) {
          throw new Error("This Stud Offer is no longer published.");
        }
        if (automaticOffer.ownerKennelId !== studListing.sellerKennelId) {
          throw new Error("This Stud Offer is no longer available.");
        }
        if (automaticOffer.approvalMode !== "AUTOMATIC") {
          throw new Error("This Stud Offer requires Manual Approval.");
        }
        await assertDamMeetsStudContractRequirements({
          client: tx,
          damDogId: dam.id,
          currentEpoch,
          requirements: {
            brucellosisNegativeRequired:
              automaticOffer.brucellosisNegativeRequired,
            healthRequirements: automaticOffer.healthRequirements,
            titleRequirement: automaticOffer.titleRequirement,
          },
        });
        studFeeAmount =
          automaticOffer.compensationType === "PUPPY_BACK"
            ? 0
            : automaticOffer.cashAmount ?? 0;
        requiresBrucellosisNegativeDam = false;
      } else {
        assertDamMeetsStudListingRequirements({
          dam,
          listing: studListing,
        });
      }
      }
    }

    const publicStudRequiresDamNegative =
      usesPublicStud && Boolean(requiresBrucellosisNegativeDam);
    const [validDamBrucellosisTest, validSireBrucellosisTest] =
      await Promise.all([
        getValidNegativeBrucellosisTest(tx, {
          dogId: dam.id,
          currentEpoch,
        }),
        getValidNegativeBrucellosisTest(tx, {
          dogId: sire.id,
          currentEpoch,
        }),
      ]);
    const shouldTestDamBrucellosis =
      Boolean(args.testDamBrucellosis) ||
      (publicStudRequiresDamNegative && !validDamBrucellosisTest);
    const shouldTestSireBrucellosis =
      !usesPublicStud &&
      Boolean(args.testSireBrucellosis) &&
      !validSireBrucellosisTest;
    if (returnServiceContract?.brucellosisNegativeRequired && !validDamBrucellosisTest) {
      throw new Error("The dam does not currently meet the brucellosis requirement from this contract.");
    }
    const brucellosisTestCost =
      (shouldTestDamBrucellosis ? BRUCELLOSIS_TEST_FEE : 0) +
      (shouldTestSireBrucellosis ? BRUCELLOSIS_TEST_FEE : 0);

    const kennel = await tx.kennel.findUnique({
      where: { id: kennelId },
      select: { id: true, balance: true, name: true },
    });

    if (!kennel) {
      throw new Error("Kennel not found.");
    }

    const totalCost = BREEDING_FEE + studFeeAmount;
    const totalCostWithTests = totalCost + brucellosisTestCost;

    if (kennel.balance < totalCostWithTests) {
      throw new Error(
        usesPublicStud
          ? "Insufficient funds for the breeding, stud, and brucellosis test fees."
          : "Insufficient funds for the breeding and brucellosis test fees."
      );
    }

    let buyerRunningBalance = kennel.balance;
    const positiveBrucellosisResults: string[] = [];

    if (shouldTestDamBrucellosis) {
      const test = await runBrucellosisTest(tx, {
        dogId: dam.id,
        currentEpoch,
      });
      buyerRunningBalance -= BRUCELLOSIS_TEST_FEE;

      await tx.ledgerTransaction.create({
        data: {
          kennelId: kennel.id,
          transactionType: "HEALTH_TEST_FEE",
          amount: -BRUCELLOSIS_TEST_FEE,
          balanceAfter: buyerRunningBalance,
          occurredAtEpoch: currentEpoch,
          dogId: dam.id,
          memo: `Brucellosis test for ${displayDogName(dam)}.`,
          metadataJson: {
            diseaseCode: "BRUCELLOSIS",
            resultCode: test.resultCode,
          },
        },
      });

      if (test.resultCode === "POSITIVE") {
        positiveBrucellosisResults.push(displayDogName(dam));
      }
    }

    if (shouldTestSireBrucellosis) {
      const test = await runBrucellosisTest(tx, {
        dogId: sire.id,
        currentEpoch,
      });
      buyerRunningBalance -= BRUCELLOSIS_TEST_FEE;

      await tx.ledgerTransaction.create({
        data: {
          kennelId: kennel.id,
          transactionType: "HEALTH_TEST_FEE",
          amount: -BRUCELLOSIS_TEST_FEE,
          balanceAfter: buyerRunningBalance,
          occurredAtEpoch: currentEpoch,
          dogId: sire.id,
          memo: `Brucellosis test for ${displayDogName(sire)}.`,
          metadataJson: {
            diseaseCode: "BRUCELLOSIS",
            resultCode: test.resultCode,
          },
        },
      });

      if (test.resultCode === "POSITIVE") {
        positiveBrucellosisResults.push(displayDogName(sire));
      }
    }

    if (brucellosisTestCost > 0) {
      await tx.kennel.update({
        where: { id: kennel.id },
        data: { balance: buyerRunningBalance },
      });
    }

    if (positiveBrucellosisResults.length > 0) {
      return {
        blockedMessage: `Breeding stopped. Brucellosis test positive for ${positiveBrucellosisResults.join(
          " and "
        )}.`,
      };
    }

    const balanceAfterBreedingFee = buyerRunningBalance - BREEDING_FEE;
    const buyerBalanceAfter = balanceAfterBreedingFee - studFeeAmount;

    await tx.kennel.update({
      where: { id: kennel.id },
      data: { balance: buyerBalanceAfter },
    });

    if (studSellerKennelId && studFeeAmount > 0) {
      const studSeller = await tx.kennel.findUnique({
        where: { id: studSellerKennelId },
        select: { id: true, balance: true },
      });

      if (!studSeller) {
        throw new Error("Stud owner kennel not found.");
      }

      studSellerBalanceAfter = studSeller.balance + studFeeAmount;

      await tx.kennel.update({
        where: { id: studSeller.id },
        data: { balance: studSellerBalanceAfter },
      });
    }

    const createdAttempt = await tx.breedingAttempt.create({
      data: {
        sireId: sire.id,
        damId: dam.id,
        breedCode2: sire.breedCode2,
        createdEpoch: currentEpoch,
        pregCheckEpoch: currentEpoch + timing.pregCheckDelayHours,
        dueEpoch: currentEpoch + timing.gestationHours,
        checkedEpoch: null,
        isPregnant: null,
        status: "INITIATED",
        createdByKennelId: kennelId,
        rngSeed,
        studFeeAmount: returnServiceContract ? 0 : studFeeAmount,
        notes: usesPublicStud
          ? returnServiceContract
            ? "Return Service breeding attempt created from the original Stud Contract."
            : "Beta breeding attempt created with a public stud listing."
          : "Beta breeding attempt created from breeding page.",
      },
      select: {
        id: true,
        sireId: true,
        damId: true,
        breedCode2: true,
        createdEpoch: true,
        pregCheckEpoch: true,
        dueEpoch: true,
        status: true,
      },
    });

    if (automaticOffer) {
      await tx.studContract.create({
        data: {
          sourceOfferId: automaticOffer.id,
          sourceOfferVersion: automaticOffer.version,
          sireDogId: sire.id,
          damDogId: dam.id,
          sireKennelId: automaticOffer.ownerKennelId,
          damKennelId: kennelId,
          status: "ACCEPTED",
          compensationType: automaticOffer.compensationType,
          cashAmount: automaticOffer.cashAmount,
          puppyPickPosition: automaticOffer.puppyPickPosition,
          puppySex: automaticOffer.puppySex,
          minimumLitterSize: automaticOffer.minimumLitterSize,
          noLitterReturnService: automaticOffer.noLitterReturnService,
          smallLitterReturnThreshold: automaticOffer.smallLitterReturnThreshold,
          brucellosisNegativeRequired:
            automaticOffer.brucellosisNegativeRequired,
          titleRequirement: automaticOffer.titleRequirement,
          approvalMode: automaticOffer.approvalMode,
          requestedAt: new Date(),
          acceptedAt: new Date(),
          breedingAttemptId: createdAttempt.id,
          healthRequirements: {
            create: automaticOffer.healthRequirements.map((requirement) => ({
              healthTestCode: requirement.healthTestCode,
              requirementLevel: requirement.requirementLevel,
            })),
          },
        },
      });
    }
    if (manualContract) {
      const accepted = await tx.studContract.updateMany({
        where: { id: manualContract.id, status: "PENDING" },
        data: { status: "ACCEPTED", acceptedAt: new Date(), breedingAttemptId: createdAttempt.id },
      });
      if (accepted.count !== 1) throw new Error("This Stud approval request is no longer pending.");
    }
    if (returnServiceContract && args.returnServiceId) {
      const usedAt = new Date();
      const consumed = await tx.studContractReturnService.updateMany({
        where: { id: args.returnServiceId, status: "AVAILABLE", expiresAt: { gt: usedAt } },
        data: { status: "USED", usedAt, returnBreedingAttemptId: createdAttempt.id },
      });
      if (consumed.count !== 1) throw new Error("This Return Service is no longer available.");
    }

    await tx.ledgerTransaction.create({
      data: {
        kennelId: kennel.id,
        transactionType: "BREEDING_FEE",
        amount: -BREEDING_FEE,
        balanceAfter: balanceAfterBreedingFee,
        occurredAtEpoch: currentEpoch,
        dogId: dam.id,
        memo: `Breeding fee for ${displayDogName(dam)} x ${displayDogName(sire)}.`,
        metadataJson: {
          sireId: sire.id,
          damId: dam.id,
          breedingAttemptId: createdAttempt.id,
          studListingId: studListingId ?? null,
          brucellosisTestCost,
        },
      },
    });

    await transmitBrucellosisThroughBreeding(tx, {
      sireId: sire.id,
      damId: dam.id,
      currentEpoch,
      breedingAttemptId: createdAttempt.id,
    });

    if (studSellerKennelId && studFeeAmount > 0) {
      await tx.ledgerTransaction.create({
        data: {
          kennelId: kennel.id,
          transactionType: "STUD_FEE_OUT",
          amount: -studFeeAmount,
          balanceAfter: buyerBalanceAfter,
          occurredAtEpoch: currentEpoch,
          dogId: sire.id,
          counterpartyKennelId: studSellerKennelId,
          memo: `Stud fee for ${displayDogName(sire)}.`,
          metadataJson: {
            sireId: sire.id,
            damId: dam.id,
            breedingAttemptId: createdAttempt.id,
            studListingId: studListingId ?? null,
          },
        },
      });

      await tx.ledgerTransaction.create({
        data: {
          kennelId: studSellerKennelId,
          transactionType: "STUD_FEE_IN",
          amount: studFeeAmount,
          balanceAfter: studSellerBalanceAfter,
          occurredAtEpoch: currentEpoch,
          dogId: sire.id,
          counterpartyKennelId: kennel.id,
          memo: `Stud fee received for ${displayDogName(sire)}.`,
          metadataJson: {
            sireId: sire.id,
            damId: dam.id,
            breedingAttemptId: createdAttempt.id,
            studListingId: studListingId ?? null,
          },
        },
      });

      await createKennelNotice({
        client: tx,
        kennelId: studSellerKennelId,
        type: "STUD_FEE_RECEIVED",
        title: "Stud fee received",
        body: `${displayDogNameOrFallback(
          sire,
          "your stud dog"
        )} was used by ${
          kennel.name?.trim() || "another kennel"
        } with ${displayDogNameOrFallback(
          dam,
          "their bitch"
        )}. Stud fee of ${formatCurrency(studFeeAmount)} was paid to you.`,
        currentEpoch,
        linkedDogId: sire.id,
        linkedListingId: studListingId ?? null,
      });
    }

    return {
      attempt: createdAttempt,
    };
  });

  if ("blockedMessage" in attempt) {
    throw new Error(attempt.blockedMessage);
  }

  const healthConditionTruthsByDogId =
    await ensureAndLoadBreedingDisplayHealthTruths([sire.id, dam.id]);
  const sireHealthConditionTruths =
    healthConditionTruthsByDogId.get(sire.id) ?? sire.healthConditionTruths;
  const damHealthConditionTruths =
    healthConditionTruthsByDogId.get(dam.id) ?? dam.healthConditionTruths;

  return {
    ...attempt.attempt,
    sireName: displayDogName(sire),
    damName: displayDogName(dam),
    sireVisibleCategories: getVisibleCategories({
      ...sire,
      healthConditionTruths: sireHealthConditionTruths,
    }),
    damVisibleCategories: getVisibleCategories({
      ...dam,
      healthConditionTruths: damHealthConditionTruths,
    }),
    hoursUntilPregCheck: Math.max(0, attempt.attempt.pregCheckEpoch! - currentEpoch),
    hoursUntilDue: Math.max(0, attempt.attempt.dueEpoch! - currentEpoch),
  };
}

export async function createAutomaticStudContractBreedingForKennel(args: {
  kennelId: string;
  sireDogId: string;
  damDogId: string;
  studListingId?: string;
  source: "STUD_OFFER" | "LEGACY_PLAYER_STUD";
  currentEpoch: number;
}) {
  const publicStud = await resolvePublicStudForSire({
    sireDogId: args.sireDogId,
    ...(args.studListingId ? { legacyListingId: args.studListingId } : {}),
  });
  if (!publicStud || publicStud.sireDogId !== args.sireDogId) {
    throw new Error("This Stud Offer is no longer available.");
  }
  if (
    publicStud.source === "LEGACY_PLAYER_STUD" &&
    (!args.studListingId || publicStud.legacyListingId !== args.studListingId)
  ) {
    throw new Error("Public stud listing not found.");
  }
  return createBreedingAttemptForKennel({
    kennelId: args.kennelId,
    primaryDogId: args.sireDogId,
    mateDogId: args.damDogId,
    studListingId: args.studListingId,
    currentEpoch: args.currentEpoch,
    automaticStudContract: true,
    publicStudSource: publicStud.source,
  });
}

export async function attemptStudContractReturnService(args: {
  kennelId: string;
  returnServiceId: string;
  currentEpoch: number;
}) {
  const returnService = await db.studContractReturnService.findUnique({
    where: { id: args.returnServiceId },
    select: { contract: { select: { sireDogId: true, damDogId: true } } },
  });
  if (!returnService) throw new Error("Return Service not found.");
  return createBreedingAttemptForKennel({
    kennelId: args.kennelId,
    primaryDogId: returnService.contract.sireDogId,
    mateDogId: returnService.contract.damDogId,
    currentEpoch: args.currentEpoch,
    returnServiceId: args.returnServiceId,
  });
}

export async function approveManualStudContractForKennel(args: {
  contractId: string;
  sireKennelId: string;
  currentEpoch: number;
}) {
  const contract = await db.studContract.findFirst({
    where: {
      id: args.contractId,
      status: "PENDING",
      sireKennelId: args.sireKennelId,
    },
    select: { sireDogId: true, damDogId: true, damKennelId: true },
  });
  if (!contract) {
    throw new Error("This Stud approval request is no longer pending.");
  }
  return createBreedingAttemptForKennel({
    kennelId: contract.damKennelId,
    primaryDogId: contract.sireDogId,
    mateDogId: contract.damDogId,
    currentEpoch: args.currentEpoch,
    manualApprovedContractId: args.contractId,
  });
}
