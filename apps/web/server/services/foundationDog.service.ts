// apps/web/server/services/foundationDog.service.ts

import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import {
  createFoundationDogProfile,
  deriveVisibleCategoriesFromTraits,
  type FoundationBreedBaseline,
  type VisibleCategories,
} from "../../../../packages/rules/engines/foundationDog.engine";
import type { DogTraits } from "../../../../packages/rules/engines/dog.engine";
import {
  buildRegNumber,
  generateSerial7,
} from "../../../../packages/rules/engines/litter.engine";
import {
  MIN_BREED_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
} from "../../../../packages/rules/constants/lifecycle.constants";
import { SHOW_WEEK_HOURS } from "../../../../packages/rules/constants/time.constants";

const FOUNDATION_TARGET_INVENTORY = 10;
const FOUNDATION_REFILL_TRIGGER = 6;
const FOUNDATION_REFILL_BATCH = 6;

const FOUNDATION_FIXED_PRICE = 1500;
const FOUNDATION_LISTING_TYPE = "FOUNDATION";
const FOUNDATION_DESCRIPTION_PUBLIC = "Foundation dog available for purchase.";
const FOUNDATION_REFRESH_HOURS = 3 * SHOW_WEEK_HOURS;

const LIVE_BASELINE_MIN_SAMPLE = 8;

const FOUNDATION_MIN_AGE_HOURS = MIN_SHOW_AGE_HOURS + 30;
const FOUNDATION_MAX_AGE_HOURS = MIN_BREED_AGE_HOURS + 365;

/**
 * 1–20 trait scale, 10 = ideal.
 * This is only a fallback center point when there is not enough live
 * breed data yet. The engine still applies offsets, variance, and
 * validation rules after this baseline.
 */
const GLOBAL_FALLBACK_BASELINE: DogTraits = {
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

export type FoundationDogMarketDto = {
  listingId: string;
  dogId: string;
  callName: string | null;
  regNumber: string;
  breedCode2: string;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  price: number;
  visibleCategories: VisibleCategories;
};

type HiddenTraitRecord = {
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

type MarketDogRecord = HiddenTraitRecord & {
  id: string;
  callName: string | null;
  regNumber: string;
  breedCode2: string;
  sex: "M" | "F";
  birthEpoch: number;
};

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildFoundationCallName(breedCode2: string): string {
  const suffix = String(randomIntInclusive(0, 99999)).padStart(5, "0");
  return `${breedCode2}-${suffix}`;
}

function pickFoundationBirthEpoch(currentEpoch: number): number {
  const ageHours = randomIntInclusive(
    FOUNDATION_MIN_AGE_HOURS,
    FOUNDATION_MAX_AGE_HOURS
  );

  return currentEpoch - ageHours;
}

function toDogTraits(record: HiddenTraitRecord): DogTraits {
  return {
    head: record.traitHead,
    forequarters: record.traitForequarters,
    hindquarters: record.traitHindquarters,
    gait: record.traitGait,
    coat: record.traitCoat,
    size: record.traitSize,
    temperament: record.traitTemperament,
    show_shine: record.traitShowShine,
    feet: record.traitFeet,
    topline: record.traitTopline,
  };
}

export function getVisibleCategoriesFromDogRecord(
  dog: HiddenTraitRecord
): VisibleCategories {
  return deriveVisibleCategoriesFromTraits(toDogTraits(dog));
}

function toFoundationDogMarketDto(args: {
  listingId: string;
  price: number;
  dog: MarketDogRecord;
  currentEpoch: number;
}): FoundationDogMarketDto {
  const { listingId, price, dog, currentEpoch } = args;

  return {
    listingId,
    dogId: dog.id,
    callName: dog.callName,
    regNumber: dog.regNumber,
    breedCode2: dog.breedCode2,
    sex: dog.sex,
    birthEpoch: dog.birthEpoch,
    ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
    price,
    visibleCategories: getVisibleCategoriesFromDogRecord(dog),
  };
}

async function getLiveBreedBaseline(
  breedCode2: string
): Promise<FoundationBreedBaseline> {
  const rows = await db.dog.findMany({
    where: {
      breedCode2,
      lifecycleState: "ALIVE",
      ownerKennelId: { not: null },
    },
    select: {
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

  if (rows.length < LIVE_BASELINE_MIN_SAMPLE) {
    return {
      breedCode2,
      traitMeans: GLOBAL_FALLBACK_BASELINE,
    };
  }

  return {
    breedCode2,
    traitMeans: {
      head: Number(average(rows.map((row) => row.traitHead)).toFixed(2)),
      forequarters: Number(
        average(rows.map((row) => row.traitForequarters)).toFixed(2)
      ),
      hindquarters: Number(
        average(rows.map((row) => row.traitHindquarters)).toFixed(2)
      ),
      gait: Number(average(rows.map((row) => row.traitGait)).toFixed(2)),
      coat: Number(average(rows.map((row) => row.traitCoat)).toFixed(2)),
      size: Number(average(rows.map((row) => row.traitSize)).toFixed(2)),
      temperament: Number(
        average(rows.map((row) => row.traitTemperament)).toFixed(2)
      ),
      show_shine: Number(
        average(rows.map((row) => row.traitShowShine)).toFixed(2)
      ),
      feet: Number(average(rows.map((row) => row.traitFeet)).toFixed(2)),
      topline: Number(average(rows.map((row) => row.traitTopline)).toFixed(2)),
    },
  };
}

async function generateUniqueFoundationIdentity(
  breedCode2: string
): Promise<{ regNumber: string; litterOrder: number }> {
  const litterOrder = 1;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const serial7 = generateSerial7(Math.random);
    const regNumber = buildRegNumber(breedCode2, serial7, litterOrder);

    const existing = await db.dog.findUnique({
      where: { regNumber },
      select: { id: true },
    });

    if (!existing) {
      return { regNumber, litterOrder };
    }
  }

  throw new Error("Unable to generate unique foundation registration number.");
}

async function createOneFoundationDog(args: {
  breedCode2: string;
  currentEpoch: number;
}): Promise<void> {
  const { breedCode2, currentEpoch } = args;

  const breedBaseline = await getLiveBreedBaseline(breedCode2);
  const { regNumber, litterOrder } = await generateUniqueFoundationIdentity(
    breedCode2
  );

  const generated = createFoundationDogProfile({
    dogId: randomUUID(),
    regNumber,
    breedCode2,
    birthEpoch: pickFoundationBirthEpoch(currentEpoch),
    callName: buildFoundationCallName(breedCode2),
    breedBaseline,
  });

  await db.$transaction(async (tx) => {
    const createdDog = await tx.dog.create({
      data: {
        regNumber: generated.dog.regNumber,
        callName: generated.callName,
        registeredName: null,
        breedCode2: generated.dog.breedCode2,
        ownerKennelId: null,
        breederKennelId: null,
        sireId: null,
        damId: null,
        litterId: null,
        litterOrder,
        sex: generated.dog.sex,
        birthEpoch: generated.dog.birthEpoch,
        lifecycleState: "ALIVE",
        marketState: "LISTED_NPC",
        originType: "FOUNDATION",
        isFoundation: true,

        traitHead: generated.dog.traits.head,
        traitForequarters: generated.dog.traits.forequarters,
        traitHindquarters: generated.dog.traits.hindquarters,
        traitGait: generated.dog.traits.gait,
        traitCoat: generated.dog.traits.coat,
        traitSize: generated.dog.traits.size,
        traitTemperament: generated.dog.traits.temperament,
        traitShowShine: generated.dog.traits.show_shine,
        traitFeet: generated.dog.traits.feet,
        traitTopline: generated.dog.traits.topline,
      },
      select: {
        id: true,
      },
    });

    await tx.dogListing.create({
      data: {
        dogId: createdDog.id,
        sellerKennelId: null,
        sellerType: "SYSTEM",
        askingPrice: FOUNDATION_FIXED_PRICE,
        listingType: FOUNDATION_LISTING_TYPE,
        status: "ACTIVE",
        listedAtEpoch: currentEpoch,
        expiresAtEpoch: currentEpoch + FOUNDATION_REFRESH_HOURS,
        descriptionPublic: FOUNDATION_DESCRIPTION_PUBLIC,
      },
    });
  });
}

export async function expireStaleFoundationListings(args: {
  currentEpoch: number;
  breedCode2?: string;
}): Promise<number> {
  const { currentEpoch, breedCode2 } = args;

  const staleListings = await db.dogListing.findMany({
    where: {
      sellerType: "SYSTEM",
      listingType: FOUNDATION_LISTING_TYPE,
      status: "ACTIVE",
      listedAtEpoch: {
        lte: currentEpoch - FOUNDATION_REFRESH_HOURS,
      },
      dog: {
        ownerKennelId: null,
        lifecycleState: "ALIVE",
        marketState: "LISTED_NPC",
        originType: "FOUNDATION",
        isFoundation: true,
        ...(breedCode2 ? { breedCode2 } : {}),
      },
    },
    select: {
      id: true,
      dogId: true,
    },
  });

  if (staleListings.length === 0) {
    return 0;
  }

  await db.$transaction(async (tx) => {
    for (const listing of staleListings) {
      await tx.dogListing.update({
        where: { id: listing.id },
        data: {
          status: "EXPIRED",
          expiresAtEpoch: currentEpoch,
        },
      });

      await tx.dog.update({
        where: { id: listing.dogId },
        data: {
          marketState: "NOT_FOR_SALE",
        },
      });
    }
  });

  return staleListings.length;
}

export async function countUnsoldFoundationDogsByBreed(
  breedCode2: string
): Promise<number> {
  return db.dog.count({
    where: {
      breedCode2,
      originType: "FOUNDATION",
      isFoundation: true,
      marketState: "LISTED_NPC",
      ownerKennelId: null,
      lifecycleState: "ALIVE",
      listings: {
        some: {
          sellerType: "SYSTEM",
          listingType: FOUNDATION_LISTING_TYPE,
          status: "ACTIVE",
        },
      },
    },
  });
}

export async function ensureFoundationInventoryForBreed(args: {
  breedCode2: string;
  currentEpoch: number;
}): Promise<void> {
  const { breedCode2, currentEpoch } = args;

  await expireStaleFoundationListings({
    currentEpoch,
    breedCode2,
  });

  const currentCount = await countUnsoldFoundationDogsByBreed(breedCode2);

  if (currentCount >= FOUNDATION_REFILL_TRIGGER) {
    return;
  }

  const createCount = Math.min(
    FOUNDATION_REFILL_BATCH,
    FOUNDATION_TARGET_INVENTORY - currentCount
  );

  for (let index = 0; index < createCount; index += 1) {
    await createOneFoundationDog({
      breedCode2,
      currentEpoch,
    });
  }
}

export async function ensureFoundationInventoryForBreeds(args: {
  breedCode2List: string[];
  currentEpoch: number;
}): Promise<void> {
  for (const breedCode2 of args.breedCode2List) {
    await ensureFoundationInventoryForBreed({
      breedCode2,
      currentEpoch: args.currentEpoch,
    });
  }
}

export async function seedFoundationDogsForBreed(args: {
  breedCode2: string;
  currentEpoch: number;
  count: number;
}): Promise<void> {
  const { breedCode2, currentEpoch, count } = args;

  for (let index = 0; index < count; index += 1) {
    await createOneFoundationDog({
      breedCode2,
      currentEpoch,
    });
  }
}

export async function listFoundationDogs(args: {
  breedCode2?: string;
  currentEpoch: number;
}): Promise<FoundationDogMarketDto[]> {
  const { breedCode2, currentEpoch } = args;

  await expireStaleFoundationListings({ currentEpoch, breedCode2 });

  if (breedCode2) {
    await ensureFoundationInventoryForBreed({ breedCode2, currentEpoch });
  }

  const listings = await db.dogListing.findMany({
    where: {
      sellerType: "SYSTEM",
      listingType: FOUNDATION_LISTING_TYPE,
      status: "ACTIVE",
      dog: {
        originType: "FOUNDATION",
        isFoundation: true,
        marketState: "LISTED_NPC",
        ownerKennelId: null,
        lifecycleState: "ALIVE",
        ...(breedCode2 ? { breedCode2 } : {}),
      },
    },
    orderBy: [{ listedAtEpoch: "asc" }, { askingPrice: "asc" }],
    select: {
      id: true,
      askingPrice: true,
      dog: {
        select: {
          id: true,
          callName: true,
          regNumber: true,
          breedCode2: true,
          sex: true,
          birthEpoch: true,
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

  return listings.map((listing) =>
    toFoundationDogMarketDto({
      listingId: listing.id,
      price: listing.askingPrice,
      dog: listing.dog,
      currentEpoch,
    })
  );
}

export async function getFoundationDogById(args: {
  dogId: string;
  currentEpoch: number;
}): Promise<FoundationDogMarketDto | null> {
  const { dogId, currentEpoch } = args;

  await expireStaleFoundationListings({ currentEpoch });

  const listing = await db.dogListing.findFirst({
    where: {
      dogId,
      sellerType: "SYSTEM",
      listingType: FOUNDATION_LISTING_TYPE,
      status: "ACTIVE",
      dog: {
        originType: "FOUNDATION",
        isFoundation: true,
        marketState: "LISTED_NPC",
        ownerKennelId: null,
        lifecycleState: "ALIVE",
      },
    },
    select: {
      id: true,
      askingPrice: true,
      dog: {
        select: {
          id: true,
          callName: true,
          regNumber: true,
          breedCode2: true,
          sex: true,
          birthEpoch: true,
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

  if (!listing) {
    return null;
  }

  return toFoundationDogMarketDto({
    listingId: listing.id,
    price: listing.askingPrice,
    dog: listing.dog,
    currentEpoch,
  });
}

export async function buyFoundationDog(args: {
  dogId: string;
  kennelId: string;
  currentEpoch: number;
}): Promise<FoundationDogMarketDto> {
  const { dogId, kennelId, currentEpoch } = args;

  const purchased = await db.$transaction(async (tx) => {
    const kennel = await tx.kennel.findUnique({
      where: { id: kennelId },
      select: {
        id: true,
        balance: true,
      },
    });

    if (!kennel) {
      throw new Error("Kennel not found.");
    }

    const listing = await tx.dogListing.findFirst({
      where: {
        dogId,
        sellerType: "SYSTEM",
        listingType: FOUNDATION_LISTING_TYPE,
        status: "ACTIVE",
        dog: {
          originType: "FOUNDATION",
          isFoundation: true,
          marketState: "LISTED_NPC",
          ownerKennelId: null,
          lifecycleState: "ALIVE",
        },
      },
      select: {
        id: true,
        askingPrice: true,
        dog: {
          select: {
            id: true,
            callName: true,
            regNumber: true,
            breedCode2: true,
            sex: true,
            birthEpoch: true,
            ownerKennelId: true,
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

    if (!listing) {
      throw new Error("Foundation dog not found.");
    }

    if (listing.dog.ownerKennelId !== null) {
      throw new Error("Dog already sold.");
    }

    if (kennel.balance < listing.askingPrice) {
      throw new Error("Insufficient funds.");
    }

    const balanceAfter = kennel.balance - listing.askingPrice;

    await tx.kennel.update({
      where: { id: kennel.id },
      data: {
        balance: balanceAfter,
      },
    });

    await tx.ledgerTransaction.create({
      data: {
        kennelId: kennel.id,
        transactionType: "DOG_PURCHASE",
        amount: -listing.askingPrice,
        balanceAfter,
        occurredAtEpoch: currentEpoch,
        dogId: listing.dog.id,
        memo: `Purchased foundation dog ${listing.dog.regNumber}`,
      },
    });

    await tx.dog.update({
      where: { id: listing.dog.id },
      data: {
        ownerKennelId: kennel.id,
        marketState: "NOT_FOR_SALE",
      },
    });

    await tx.dogListing.update({
      where: { id: listing.id },
      data: {
        status: "SOLD",
        soldAtEpoch: currentEpoch,
        buyerKennelId: kennel.id,
      },
    });

    return {
      listingId: listing.id,
      askingPrice: listing.askingPrice,
      dog: listing.dog,
    };
  });

  return toFoundationDogMarketDto({
    listingId: purchased.listingId,
    price: purchased.askingPrice,
    dog: purchased.dog,
    currentEpoch,
  });
}


