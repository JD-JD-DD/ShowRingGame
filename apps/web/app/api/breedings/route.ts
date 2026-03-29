import { db } from "@/lib/db";
import {
  DAM_MAX_BREED_AGE_HOURS,
  deriveVisibleCategoriesFromTraits,
  MIN_BREED_AGE_HOURS,
} from "@showring/rules";

const PREG_CHECK_HOURS = 30;
const GESTATION_HOURS = 60;

type DogForBreeding = {
  id: string;
  callName: string | null;
  regNumber: string;
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
};

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
  return deriveVisibleCategoriesFromTraits({
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
  });
}

async function getDogForBreeding(dogId: string): Promise<DogForBreeding | null> {
  return db.dog.findUnique({
    where: { id: dogId },
    select: {
      id: true,
      callName: true,
      regNumber: true,
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
    },
  });
}

export async function resolveBreedingProgressForKennel(args: {
  kennelId: string;
  currentEpoch: number;
}) {
  const { kennelId, currentEpoch } = args;

  await db.breedingAttempt.updateMany({
    where: {
      createdByKennelId: kennelId,
      status: "INITIATED",
      isPregnant: null,
      pregCheckEpoch: {
        not: null,
        lte: currentEpoch,
      },
    },
    data: {
      status: "PREGNANT",
      isPregnant: true,
      checkedEpoch: currentEpoch,
    },
  });
}

export async function listBreedingsForKennel(args: {
  kennelId: string;
  currentEpoch: number;
  dogId?: string;
}) {
  const { kennelId, currentEpoch, dogId } = args;

  await resolveBreedingProgressForKennel({ kennelId, currentEpoch });

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
          regNumber: true,
        },
      },
      dam: {
        select: {
          id: true,
          callName: true,
          regNumber: true,
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
    sireName: attempt.sire.callName ?? attempt.sire.regNumber,
    damName: attempt.dam.callName ?? attempt.dam.regNumber,
    hoursUntilPregCheck:
      attempt.pregCheckEpoch !== null
        ? Math.max(0, attempt.pregCheckEpoch - currentEpoch)
        : null,
    hoursUntilDue:
      attempt.dueEpoch !== null ? Math.max(0, attempt.dueEpoch - currentEpoch) : null,
  }));
}

export async function createBreedingAttemptForKennel(args: {
  kennelId: string;
  primaryDogId: string;
  mateDogId: string;
  currentEpoch: number;
}) {
  const { kennelId, primaryDogId, mateDogId, currentEpoch } = args;

  const [primaryDog, mateDog] = await Promise.all([
    getDogForBreeding(primaryDogId),
    getDogForBreeding(mateDogId),
  ]);

  if (!primaryDog || !mateDog) {
    throw new Error("One or both dogs could not be found.");
  }

  if (primaryDog.ownerKennelId !== kennelId || mateDog.ownerKennelId !== kennelId) {
    throw new Error("You may only breed dogs owned by your kennel.");
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
      `${primaryDog.callName ?? primaryDog.regNumber} is not breeding eligible.`
    );
  }

  if (!isBreedAgeEligible(mateDog, currentEpoch)) {
    throw new Error(
      `${mateDog.callName ?? mateDog.regNumber} is not breeding eligible.`
    );
  }

  const sire = primaryDog.sex === "M" ? primaryDog : mateDog;
  const dam = primaryDog.sex === "F" ? primaryDog : mateDog;

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

  const attempt = await db.breedingAttempt.create({
    data: {
      sireId: sire.id,
      damId: dam.id,
      breedCode2: sire.breedCode2,
      createdEpoch: currentEpoch,
      pregCheckEpoch: currentEpoch + PREG_CHECK_HOURS,
      dueEpoch: currentEpoch + GESTATION_HOURS,
      checkedEpoch: null,
      isPregnant: null,
      status: "INITIATED",
      createdByKennelId: kennelId,
      rngSeed: Math.floor(Math.random() * 1_000_000),
      studFeeAmount: 0,
      notes: "Beta breeding attempt created from breeding page.",
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

  return {
    ...attempt,
    sireName: sire.callName ?? sire.regNumber,
    damName: dam.callName ?? dam.regNumber,
    sireVisibleCategories: getVisibleCategories(sire),
    damVisibleCategories: getVisibleCategories(dam),
    hoursUntilPregCheck: Math.max(0, attempt.pregCheckEpoch! - currentEpoch),
    hoursUntilDue: Math.max(0, attempt.dueEpoch! - currentEpoch),
  };
}
