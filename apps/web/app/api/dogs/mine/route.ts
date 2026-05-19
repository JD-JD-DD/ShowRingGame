import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { getKennelForUser } from "@/server/services/kennel.service";
import { resolveBreedingProgressForKennel } from "@/server/services/breeding.service";
import {
  DAM_MAX_BREED_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  deriveVisibleCategoriesFromTraits,
} from "@showring/rules";

const RECENT_BREEDING_RESULT_HOURS = 14;

type MineDog = {
  id: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  breedCode2: string;
  sex: "M" | "F";
  birthEpoch: number;
  lifecycleState: string;
  marketState: string;
  originType: string;
  isFoundation: boolean;
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
  breedingAttemptsAsDam: Array<{
    id: string;
    status:
      | "INITIATED"
      | "CHECKED_NOT_PREGNANT"
      | "PREGNANT"
      | "WHELPED"
      | "FAILED"
      | "CANCELLED";
    createdEpoch: number;
    pregCheckEpoch: number | null;
    dueEpoch: number | null;
    checkedEpoch: number | null;
    whelpedEpoch: number | null;
  }>;
};

type BreedingCardStatus = {
  label:
    | "Open"
    | "Pending Pregnancy Confirmation"
    | "Pregnant"
    | "Did Not Take"
    | "Whelped"
    | "Available for Stud"
    | "Not Eligible";
  pregCheckInHours: number | null;
  dueInHours: number | null;
};

function toVisibleCategories(dog: MineDog) {
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

function getBreedingCardStatus(
  dog: MineDog,
  currentEpoch: number
): BreedingCardStatus {
  const ageHours = Math.max(0, currentEpoch - dog.birthEpoch);
  const isAlive = dog.lifecycleState === "ALIVE";
  const oldEnough = ageHours >= MIN_BREED_AGE_HOURS;
  const notTooOldIfFemale =
    dog.sex === "F" ? ageHours <= DAM_MAX_BREED_AGE_HOURS : true;

  const isEligible = isAlive && oldEnough && notTooOldIfFemale;

  if (!isEligible) {
    return {
      label: "Not Eligible",
      pregCheckInHours: null,
      dueInHours: null,
    };
  }

  if (dog.sex === "M") {
    return {
      label: "Available for Stud",
      pregCheckInHours: null,
      dueInHours: null,
    };
  }

  const activeDamAttempt =
    dog.breedingAttemptsAsDam.find(
      (attempt) =>
        attempt.status === "PREGNANT" || attempt.status === "INITIATED"
    ) ?? null;

  if (activeDamAttempt?.status === "PREGNANT") {
    return {
      label: "Pregnant",
      pregCheckInHours: null,
      dueInHours:
        activeDamAttempt.dueEpoch == null
          ? null
          : Math.max(0, activeDamAttempt.dueEpoch - currentEpoch),
    };
  }

  if (activeDamAttempt?.status === "INITIATED") {
    return {
      label: "Pending Pregnancy Confirmation",
      pregCheckInHours:
        activeDamAttempt.pregCheckEpoch == null
          ? null
          : Math.max(0, activeDamAttempt.pregCheckEpoch - currentEpoch),
      dueInHours: null,
    };
  }

  const recentWhelpedAttempt =
    dog.breedingAttemptsAsDam.find(
      (attempt) =>
        attempt.status === "WHELPED" &&
        attempt.whelpedEpoch !== null &&
        currentEpoch - attempt.whelpedEpoch <= RECENT_BREEDING_RESULT_HOURS
    ) ?? null;

  if (recentWhelpedAttempt) {
    return {
      label: "Whelped",
      pregCheckInHours: null,
      dueInHours: null,
    };
  }

  const recentNotPregnantAttempt =
    dog.breedingAttemptsAsDam.find(
      (attempt) =>
        attempt.status === "CHECKED_NOT_PREGNANT" &&
        attempt.checkedEpoch !== null &&
        currentEpoch - attempt.checkedEpoch <= RECENT_BREEDING_RESULT_HOURS
    ) ?? null;

  if (recentNotPregnantAttempt) {
    return {
      label: "Did Not Take",
      pregCheckInHours: null,
      dueInHours: null,
    };
  }

  return {
    label: "Open",
    pregCheckInHours: null,
    dueInHours: null,
  };
}

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const currentEpoch = getCurrentEpoch();
    await resolveBreedingProgressForKennel({ kennelId: kennel.id, currentEpoch });

    const dogs: MineDog[] = await db.dog.findMany({
      where: {
        ownerKennelId: kennel.id,
        lifecycleState: "ALIVE",
      },
      orderBy: [{ birthEpoch: "desc" }],
      select: {
        id: true,
        callName: true,
        registeredName: true,
        regNumber: true,
        breedCode2: true,
        sex: true,
        birthEpoch: true,
        lifecycleState: true,
        marketState: true,
        originType: true,
        isFoundation: true,
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
        breedingAttemptsAsDam: {
          orderBy: [{ createdEpoch: "desc" }],
          take: 5,
          select: {
            id: true,
            status: true,
            createdEpoch: true,
            pregCheckEpoch: true,
            dueEpoch: true,
            checkedEpoch: true,
            whelpedEpoch: true,
          },
        },
      },
    });

    return ok({
      kennel: {
        id: kennel.id,
        name: kennel.name,
        slug: kennel.slug,
        balance: kennel.balance,
        homeDistrict: kennel.homeDistrict,
        dogCount: dogs.length,
      },
      dogs: dogs.map((dog) => ({
        dogId: dog.id,
        callName: dog.callName,
        registeredName: dog.registeredName,
        regNumber: dog.regNumber,
        breedCode2: dog.breedCode2,
        breedName: dog.breed.name,
        sex: dog.sex,
        birthEpoch: dog.birthEpoch,
        ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
        lifecycleState: dog.lifecycleState,
        marketState: dog.marketState,
        originType: dog.originType,
        isFoundation: dog.isFoundation,
        visibleCategories: toVisibleCategories(dog),
        breedingCardStatus: getBreedingCardStatus(dog, currentEpoch),
      })),
    });
  } catch (error) {
    console.error("GET /api/dogs/mine failed", error);
    return fail("Unable to load kennel dogs.", 500);
  }
}
