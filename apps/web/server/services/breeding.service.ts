import { db } from "@/lib/db";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import { PLAYER_STUD_LISTING_TYPE } from "@/server/services/market.service";
import {
  BREEDING_FEE,
  DAM_MAX_BREED_AGE_HOURS,
  deriveVisibleCategoriesFromTraits,
  MIN_BREED_AGE_HOURS,
  rollBreedingTiming,
  rollLitterSize,
  resolvePregnancyCheck,
  resolveWhelp,
  WHELPING_COOLDOWN_HOURS,
} from "@showring/rules";
import { randomUUID } from "node:crypto";

type DogForBreeding = {
  id: string;
  callName: string | null;
  registeredName: string | null;
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

function displayDogName(dog: {
  registeredName?: string | null;
  callName: string | null;
  regNumber: string;
}) {
  return dog.registeredName || dog.callName || dog.regNumber;
}

async function getDogForBreeding(dogId: string): Promise<DogForBreeding | null> {
  return db.dog.findUnique({
    where: { id: dogId },
    select: {
      id: true,
      callName: true,
      registeredName: true,
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

  await resolveDogDeaths({ kennelId, currentEpoch });

  const dueAttempts: AttemptForResolution[] = await db.breedingAttempt.findMany({
    where: {
      createdByKennelId: kennelId,
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
    },
    orderBy: [{ createdEpoch: "asc" }],
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

  for (const attempt of dueAttempts) {
    if (
      attempt.status === "INITIATED" &&
      attempt.pregCheckEpoch !== null &&
      attempt.pregCheckEpoch <= currentEpoch
    ) {
      await db.$transaction(async (tx) => {
        const fresh = await tx.breedingAttempt.findUnique({
          where: { id: attempt.id },
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
          },
        });

        if (
          !fresh ||
          fresh.status !== "INITIATED" ||
          fresh.checkedEpoch !== null ||
          fresh.pregCheckEpoch === null ||
          fresh.dueEpoch === null
        ) {
          return;
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
      });
    }
  }

  for (const attempt of dueAttempts) {
    if (
      attempt.status === "PREGNANT" &&
      attempt.dueEpoch !== null &&
      attempt.dueEpoch <= currentEpoch
    ) {
      await db.$transaction(async (tx) => {
        const fresh = await tx.breedingAttempt.findUnique({
          where: { id: attempt.id },
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
          return;
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

        await tx.dog.createMany({
          data: outcome.puppies.map((puppy) => ({
            id: puppy.dogId,
            ownerKennelId: fresh.createdByKennelId,
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

        await tx.breedingAttempt.update({
          where: { id: fresh.id },
          data: {
            status: "WHELPED",
            whelpedEpoch: currentEpoch,
            litterId: outcome.litter.litterId,
          },
        });
      });
    }
  }
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
          registeredName: true,
          regNumber: true,
        },
      },
      dam: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
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

export async function createBreedingAttemptForKennel(args: {
  kennelId: string;
  primaryDogId: string;
  mateDogId: string;
  studListingId?: string;
  currentEpoch: number;
}) {
  const { kennelId, primaryDogId, mateDogId, studListingId, currentEpoch } = args;

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
    }

    const kennel = await tx.kennel.findUnique({
      where: { id: kennelId },
      select: { id: true, balance: true },
    });

    if (!kennel) {
      throw new Error("Kennel not found.");
    }

    const totalCost = BREEDING_FEE + studFeeAmount;

    if (kennel.balance < totalCost) {
      throw new Error(
        usesPublicStud
          ? "Insufficient funds for the breeding and stud fees."
          : "Insufficient funds for the breeding fee."
      );
    }

    const balanceAfterBreedingFee = kennel.balance - BREEDING_FEE;
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
        },
      },
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
    }

    return createdAttempt;
  });

  return {
    ...attempt,
    sireName: displayDogName(sire),
    damName: displayDogName(dam),
    sireVisibleCategories: getVisibleCategories(sire),
    damVisibleCategories: getVisibleCategories(dam),
    hoursUntilPregCheck: Math.max(0, attempt.pregCheckEpoch! - currentEpoch),
    hoursUntilDue: Math.max(0, attempt.dueEpoch! - currentEpoch),
  };
}
