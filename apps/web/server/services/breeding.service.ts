import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { isChampionOfRecordDog } from "@/lib/dogTitles";
import {
  getPhenotypeHealthSeverity,
  hasAllGreenRequiredPhenotypeHealthTests,
  hasCompletedRequiredPhenotypeHealthTests,
} from "@/lib/dogHealth";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import { assertDogHasNoPendingEmergencyCare } from "@/server/services/emergencyVetCare.service";
import {
  deriveCurrentVisibleCategoriesForDogDisplay,
  DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES,
} from "@/server/services/dogVisibleCategories.service";
import {
  markDogDeceased,
  resolveDogDeaths,
} from "@/server/services/lifecycle.service";
import { PLAYER_STUD_LISTING_TYPE } from "@/server/services/market.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import { ensureUncategorizedKennelRun } from "@/server/services/kennelRun.service";
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
  WHELPING_COOLDOWN_HOURS,
  WHELPING_DAM_DEATH_RATE,
} from "@showring/rules";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

type DogForBreeding = {
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
  breed: {
    name: string;
  };
  traitHead: number;
  traitForequarters: number;
  traitHindquarters: number;
  traitGait: number;
  traitCoat: number;
  traitSize: number;
  traitTemperament: number;
  traitShowShine: number;
  traitFeet: number;
  traitTopline: number;
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
    | "WHELPED"
    | "FAILED"
    | "CANCELLED";
  rngSeed: number | null;
  createdByKennelId: string | null;
  sire: {
    id: string;
    traitHead: number;
    traitForequarters: number;
    traitHindquarters: number;
    traitGait: number;
    traitCoat: number;
    traitSize: number;
    traitTemperament: number;
    traitShowShine: number;
    traitFeet: number;
    traitTopline: number;
  };
  dam: {
    id: string;
    traitHead: number;
    traitForequarters: number;
    traitHindquarters: number;
    traitGait: number;
    traitCoat: number;
    traitSize: number;
    traitTemperament: number;
    traitShowShine: number;
    traitFeet: number;
    traitTopline: number;
  };
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

type WhelpingResolutionOutcome = "WHELPED" | "SKIPPED";

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

function buildPuppySexes(seed: string, pupCount: number): Array<"M" | "F"> {
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

function mapTraits(dog: AttemptForResolution["sire"]) {
  return {
    head: dog.traitHead,
    forequarters: dog.traitForequarters,
    hindquarters: dog.traitHindquarters,
    gait: dog.traitGait,
    coat: dog.traitCoat,
    size: dog.traitSize,
    temperament: dog.traitTemperament,
    show_shine: dog.traitShowShine,
    feet: dog.traitFeet,
    topline: dog.traitTopline,
  };
}

async function loadPedigreeForCoi(
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

    if (
      resolved.status === "CHECKED_NOT_PREGNANT" &&
      fresh.createdByKennelId
    ) {
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

    const rngSeed = requireRngSeed(fresh.rngSeed);
    let pupCountNoiseIndex = 0;
    const pupCount = rollLitterSize(() => {
      const value = seeded01(`${rngSeed}:pup-count:${pupCountNoiseIndex}`);
      pupCountNoiseIndex += 1;
      return value;
    });
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
      litterId: randomUUID(),
      pupCount,
      puppyDogIds,
      puppySexes,
      sireTraits: mapTraits(fresh.sire),
      damTraits: mapTraits(fresh.dam),
      coiPercent: pairingCoi.coiPercent,
      coiGenerationDepth: pairingCoi.generationDepth,
      random01: () => {
        const value = seeded01(`${rngSeed}:whelp:${noiseIndex}`);
        noiseIndex += 1;
        return value;
      },
    });

    await tx.litter.create({
      data: {
        id: outcome.litter.litterId,
        bredByKennelId: fresh.createdByKennelId,
        sireId: outcome.litter.sireId,
        damId: outcome.litter.damId,
        breedCode2: outcome.litter.breedCode2,
        serial7: outcome.litter.serial7,
        bornEpoch: outcome.litter.bornEpoch,
        pupCount: outcome.litter.pupCount,
      },
    });

    const puppyKennelRunId = fresh.createdByKennelId
      ? fresh.dam.kennelRunId ??
        (
          await ensureUncategorizedKennelRun({
            kennelId: fresh.createdByKennelId,
            client: tx,
          })
        ).id
      : null;

    await tx.dog.createMany({
      data: outcome.puppies.map((puppy) => ({
        id: puppy.dogId,
        ownerKennelId: fresh.createdByKennelId,
        kennelRunId: puppyKennelRunId,
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
        traitHead: puppy.traits.head,
        traitForequarters: puppy.traits.forequarters,
        traitHindquarters: puppy.traits.hindquarters,
        traitGait: puppy.traits.gait,
        traitCoat: puppy.traits.coat,
        traitSize: puppy.traits.size,
        traitTemperament: puppy.traits.temperament,
        traitShowShine: puppy.traits.show_shine,
        traitFeet: puppy.traits.feet,
        traitTopline: puppy.traits.topline,
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
        body: `Litter ${outcome.litter.serial7} has been born with ${outcome.litter.pupCount} puppies.`,
        currentEpoch,
        linkedLitterId: outcome.litter.litterId,
        linkedDogId: outcome.litter.damId,
      });
    }

    const damDiedAtWhelp =
      seeded01(`${rngSeed}:whelp:dam-mortality`) <
      WHELPING_DAM_DEATH_RATE;

    if (damDiedAtWhelp) {
      await markDogDeceased({
        client: tx,
        dogId: fresh.dam.id,
        regNumber: fresh.dam.regNumber,
        ownerKennelId: fresh.dam.ownerKennelId,
        displayName: formatDogDisplayName(fresh.dam),
        deathEpoch: currentEpoch,
        cause: "WHELPING_DAM",
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

  await resolveDogDeaths({ kennelId, currentEpoch });

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
        in: ["INITIATED", "PREGNANT"],
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
}) {
  const {
    kennelId,
    primaryDogId,
    mateDogId,
    studListingId,
    currentEpoch,
  } = args;

  await resolveDogDeaths({ kennelId, currentEpoch });
  await resolveDogDeaths({ currentEpoch, dogIds: [primaryDogId, mateDogId] });

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

  if (dam.ownerKennelId !== kennelId) {
    throw new Error("You may only breed dams owned by your kennel.");
  }

  if (usesPublicStud && !studListingId) {
    throw new Error("Choose an active public stud listing for that sire.");
  }

  if (!usesPublicStud && studListingId) {
    throw new Error("Stud listings are only needed for sires outside your kennel.");
  }

  const conflictingAttempt = await db.breedingAttempt.findFirst({
    where: {
      damId: dam.id,
      status: {
        in: ["INITIATED", "PREGNANT"],
      },
    },
    select: {
      id: true,
    },
  });

  if (conflictingAttempt) {
    throw new Error("That dam already has an active breeding in progress.");
  }

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

  if (damCooldownUntil !== null && currentEpoch < damCooldownUntil) {
    throw new Error(
      `${displayDogName(dam)} is in post-whelp cooldown for ${damCooldownUntil - currentEpoch} more day(s).`
    );
  }

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

    await assertDogHasNoPendingEmergencyCare(dam.id, tx);
    await assertDogHasNoPendingEmergencyCare(sire.id, tx);

    if (usesPublicStud) {
      const studListing = await tx.dogListing.findFirst({
        where: {
          id: studListingId,
          dogId: sire.id,
          sellerType: "PLAYER",
          listingType: PLAYER_STUD_LISTING_TYPE,
          status: "ACTIVE",
        },
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
              lifecycleState: true,
              sex: true,
            },
          },
        },
      });

      if (!studListing || !studListing.sellerKennelId) {
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
      assertDamMeetsStudListingRequirements({
        dam,
        listing: studListing,
      });
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
        studFeeAmount,
        notes: usesPublicStud
          ? "Beta breeding attempt created with a public stud listing."
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
