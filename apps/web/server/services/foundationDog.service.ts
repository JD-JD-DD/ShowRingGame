import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import {
  createFoundationDogProfile,
  type FoundationBreedBaseline,
  type VisibleCategories,
} from "@showring/rules";
import type { DogTraits } from "@showring/rules";
import {
  buildRegNumber,
  generateSerial7,
} from "@showring/rules";
import {
  CURRENT_BREED_RELEASE,
  MIN_BREED_AGE_HOURS,
} from "@showring/rules";
import { SHOW_WEEK_HOURS } from "@showring/rules";
import { applyBetaBalanceTopUp } from "@/lib/betaEconomy";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import { maybeSeedFoundationBrucellosis } from "@/server/services/infectiousDisease.service";
import { ensureUncategorizedKennelRun } from "@/server/services/kennelRun.service";
import {
  deriveCurrentVisibleCategoriesForDogDisplay,
  DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES,
} from "@/server/services/dogVisibleCategories.service";

const FOUNDATION_LISTING_TYPE = "FOUNDATION";
const FOUNDATION_DESCRIPTION_PUBLIC = "Foundation dog available for purchase.";

/**
 * New beta market policy:
 * - dense breeds keep 2 active foundation listings
 * - thin breeds keep 4 active foundation listings
 * - each breed keeps at least 2 females and 1 male available
 * - listings sit for 7 in-game weeks = 49 real hours
 * - if one sells, replacement is generated immediately
 */
const FOUNDATION_DENSE_TARGET = 2;
const FOUNDATION_THIN_TARGET = 4;
const FOUNDATION_LISTING_HOURS = 7 * SHOW_WEEK_HOURS;

const LIVE_BASELINE_MIN_SAMPLE = 8;

const FOUNDATION_MIN_AGE_HOURS = MIN_BREED_AGE_HOURS;
const FOUNDATION_MAX_AGE_HOURS = MIN_BREED_AGE_HOURS + 365;

/**
 * Thin/dense decision:
 * A breed is "thin" if player supply is sparse.
 * Otherwise it is "dense".
 */
const THIN_ACTIVE_PLAYER_LISTING_MAX = 1;
const THIN_RECENT_PLAYER_SALES_MAX = 2;

/**
 * Pricing:
 * Foundation dogs should generally price slightly above actual player sale prices
 * when enough player sales exist. Otherwise fall back to engine suggested price.
 */
const PLAYER_SALE_LOOKBACK_HOURS = 12 * SHOW_WEEK_HOURS;
const MIN_PLAYER_SALES_FOR_DYNAMIC_PRICE = 3;
const FOUNDATION_PRICE_PREMIUM_MULTIPLIER = 1.12;
const FOUNDATION_PRICE_MIN_FLOOR = 1500;
const FOUNDATION_PRICE_MAX_CEILING = 6000;

/**
 * 1-20 trait scale, 10 = ideal.
 * Fallback center point when there is not enough live breed data yet.
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

const FOUNDATION_MIN_ACTIVE_FEMALES = 2;
const FOUNDATION_MIN_ACTIVE_MALES = 1;

export async function countUnsoldFoundationFemalesByBreed(
  breedCode2: string
): Promise<number> {
  return db.dog.count({
    where: {
      breedCode2,
      sex: "F",
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

export async function countUnsoldFoundationMalesByBreed(
  breedCode2: string
): Promise<number> {
  return db.dog.count({
    where: {
      breedCode2,
      sex: "M",
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

export type FoundationDogMarketDto = {
  listingId: string;
  dogId: string;
  callName: string | null;
  regNumber: string;
  breedCode2: string;
  breedName: string;
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
  breed: {
    name: string;
  };
  healthConditionTruths: Array<{
    conditionCode: string;
    geneticLiability: number;
    environmentModifier: number;
  }>;
  healthTests: Array<{
    testTypeCode: string;
    resultCode: string;
  }>;
};

type BreedFoundationPolicy = {
  targetInventory: number;
  listingHours: number;
  marketDensity: "THIN" | "DENSE";
};

type RecentPlayerSaleStats = {
  completedSalesCount: number;
  meanCompletedSalePrice: number | null;
};

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roundToNicePrice(value: number): number {
  return Math.round(value / 50) * 50;
}

function clampPrice(value: number): number {
  return Math.max(
    FOUNDATION_PRICE_MIN_FLOOR,
    Math.min(FOUNDATION_PRICE_MAX_CEILING, value)
  );
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

export function getVisibleCategoriesFromDogRecord(
  dog: HiddenTraitRecord & {
    healthConditionTruths?: MarketDogRecord["healthConditionTruths"];
    healthTests?: MarketDogRecord["healthTests"];
  }
): VisibleCategories {
  return deriveCurrentVisibleCategoriesForDogDisplay({
    storedTraits: dog,
    phenotypeHealthTruths: dog.healthConditionTruths,
    phenotypeHealthResults: dog.healthTests,
  });
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
  breedName: dog.breed.name,
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

async function countActivePlayerListingsByBreed(
  breedCode2: string
): Promise<number> {
  return db.dogListing.count({
    where: {
      sellerType: "PLAYER",
      status: "ACTIVE",
      dog: {
        breedCode2,
      },
    },
  });
}

async function getRecentPlayerSaleStats(args: {
  breedCode2: string;
  currentEpoch: number;
}): Promise<RecentPlayerSaleStats> {
  const { breedCode2, currentEpoch } = args;

  const sales = await db.dogListing.findMany({
    where: {
      sellerType: "PLAYER",
      status: "SOLD",
      soldAtEpoch: {
        gte: currentEpoch - PLAYER_SALE_LOOKBACK_HOURS,
      },
      dog: {
        breedCode2,
      },
    },
    select: {
      askingPrice: true,
    },
  });

  if (sales.length === 0) {
    return {
      completedSalesCount: 0,
      meanCompletedSalePrice: null,
    };
  }

  return {
    completedSalesCount: sales.length,
    meanCompletedSalePrice: Number(
      average(sales.map((sale) => sale.askingPrice)).toFixed(2)
    ),
  };
}

async function getFoundationPolicyForBreed(args: {
  breedCode2: string;
  currentEpoch: number;
}): Promise<BreedFoundationPolicy> {
  const { breedCode2, currentEpoch } = args;

  const [activePlayerListings, recentPlayerSales] = await Promise.all([
    countActivePlayerListingsByBreed(breedCode2),
    getRecentPlayerSaleStats({ breedCode2, currentEpoch }),
  ]);

  const isThinBreed =
    activePlayerListings <= THIN_ACTIVE_PLAYER_LISTING_MAX &&
    recentPlayerSales.completedSalesCount <= THIN_RECENT_PLAYER_SALES_MAX;

  return {
    targetInventory: isThinBreed
      ? FOUNDATION_THIN_TARGET
      : FOUNDATION_DENSE_TARGET,
    listingHours: FOUNDATION_LISTING_HOURS,
    marketDensity: isThinBreed ? "THIN" : "DENSE",
  };
}

async function isActiveReleasedBreedCode(breedCode2: string): Promise<boolean> {
  const breed = await db.breed.findFirst({
    where: {
      code2: breedCode2,
      isActive: true,
      releaseVersion: {
        lte: CURRENT_BREED_RELEASE,
      },
    },
    select: {
      code2: true,
    },
  });

  return breed !== null;
}

function getEffectiveFoundationTarget(policy: BreedFoundationPolicy): number {
  return Math.max(
    policy.targetInventory,
    FOUNDATION_MIN_ACTIVE_FEMALES + FOUNDATION_MIN_ACTIVE_MALES
  );
}

function buildForcedFoundationSexes(args: {
  femalesNeeded: number;
  malesNeeded: number;
  totalCount: number;
}): Array<"M" | "F" | undefined> {
  const forcedSexes: Array<"M" | "F" | undefined> = [];

  for (let index = 0; index < args.femalesNeeded; index += 1) {
    forcedSexes.push("F");
  }

  for (let index = 0; index < args.malesNeeded; index += 1) {
    forcedSexes.push("M");
  }

  while (forcedSexes.length < args.totalCount) {
    forcedSexes.push(undefined);
  }

  return forcedSexes;
}

async function calculateFoundationAskingPrice(args: {
  breedCode2: string;
  currentEpoch: number;
  suggestedPrice: number;
}): Promise<number> {
  const { breedCode2, currentEpoch, suggestedPrice } = args;

  const recentPlayerSales = await getRecentPlayerSaleStats({
    breedCode2,
    currentEpoch,
  });

  if (
    recentPlayerSales.completedSalesCount >= MIN_PLAYER_SALES_FOR_DYNAMIC_PRICE &&
    recentPlayerSales.meanCompletedSalePrice !== null
  ) {
    return clampPrice(
      roundToNicePrice(
        recentPlayerSales.meanCompletedSalePrice *
          FOUNDATION_PRICE_PREMIUM_MULTIPLIER
      )
    );
  }

  return clampPrice(roundToNicePrice(suggestedPrice));
}


async function createOneFoundationDog(args: {
  breedCode2: string;
  currentEpoch: number;
  forcedSex?: "M" | "F";
}): Promise<void> {
  const { breedCode2, currentEpoch, forcedSex } = args;

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

  const finalSex = forcedSex ?? generated.dog.sex;

  const askingPrice = await calculateFoundationAskingPrice({
    breedCode2,
    currentEpoch,
    suggestedPrice: generated.suggestedPrice,
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
        sex: finalSex,
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

    await ensurePhenotypeHealthTruthsForDogs(tx, [createdDog.id]);
    await maybeSeedFoundationBrucellosis(tx, {
      dogId: createdDog.id,
      currentEpoch,
    });

    await tx.dogListing.create({
      data: {
        dogId: createdDog.id,
        sellerKennelId: null,
        sellerType: "SYSTEM",
        askingPrice,
        listingType: FOUNDATION_LISTING_TYPE,
        status: "ACTIVE",
        listedAtEpoch: currentEpoch,
        expiresAtEpoch: currentEpoch + FOUNDATION_LISTING_HOURS,
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
      expiresAtEpoch: {
        lte: currentEpoch,
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

  if (!(await isActiveReleasedBreedCode(breedCode2))) {
    return;
  }

  await expireStaleFoundationListings({
    currentEpoch,
    breedCode2,
  });

  const [currentCount, currentFemaleCount, currentMaleCount, policy] =
    await Promise.all([
    countUnsoldFoundationDogsByBreed(breedCode2),
    countUnsoldFoundationFemalesByBreed(breedCode2),
    countUnsoldFoundationMalesByBreed(breedCode2),
    getFoundationPolicyForBreed({ breedCode2, currentEpoch }),
  ]);

  const targetInventory = getEffectiveFoundationTarget(policy);
  const femalesNeeded = Math.max(
    0,
    FOUNDATION_MIN_ACTIVE_FEMALES - currentFemaleCount
  );
  const malesNeeded = Math.max(
    0,
    FOUNDATION_MIN_ACTIVE_MALES - currentMaleCount
  );

  if (
    currentCount >= targetInventory &&
    femalesNeeded === 0 &&
    malesNeeded === 0
  ) {
    return;
  }

  const createCount = Math.max(
    targetInventory - currentCount,
    femalesNeeded + malesNeeded
  );

  const forcedSexes = buildForcedFoundationSexes({
    femalesNeeded,
    malesNeeded,
    totalCount: createCount,
  });

  for (const forcedSex of forcedSexes) {
    await createOneFoundationDog({
      breedCode2,
      currentEpoch,
      forcedSex,
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

  if (!(await isActiveReleasedBreedCode(breedCode2))) {
    return;
  }

  const [currentFemaleCount, currentMaleCount] = await Promise.all([
    countUnsoldFoundationFemalesByBreed(breedCode2),
    countUnsoldFoundationMalesByBreed(breedCode2),
  ]);

  const femalesNeeded = Math.max(
    0,
    FOUNDATION_MIN_ACTIVE_FEMALES - currentFemaleCount
  );
  const malesNeeded = Math.max(
    0,
    FOUNDATION_MIN_ACTIVE_MALES - currentMaleCount
  );

  const forcedSexes = buildForcedFoundationSexes({
    femalesNeeded,
    malesNeeded,
    totalCount: count,
  });

  for (const forcedSex of forcedSexes) {
    await createOneFoundationDog({
      breedCode2,
      currentEpoch,
      forcedSex,
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
    orderBy: [
      { dog: { breedCode2: "asc" } },
      { listedAtEpoch: "asc" },
      { askingPrice: "asc" },
    ],
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

  const purchasedDogId = await db.$transaction(async (tx) => {
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
            regNumber: true,
            breedCode2: true,
            ownerKennelId: true,
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

    const kennelRun = await ensureUncategorizedKennelRun({
      kennelId: kennel.id,
      client: tx,
    });
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
        kennelRunId: kennelRun.id,
        marketState: "NOT_FOR_SALE",
      },
    });

    await tx.dogEmergencyCareEvent.updateMany({
      where: {
        dogId: listing.dog.id,
        kennelIdAtEvent: null,
        status: "PENDING",
      },
      data: {
        status: "CANCELED",
        resolvedAtEpoch: currentEpoch,
        canceledAtEpoch: currentEpoch,
        canceledReason: "Canceled during foundation purchase; event originated while system-owned.",
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

    return listing.dog.id;
  });

  const purchasedDog = await db.dog.findUnique({
    where: { id: purchasedDogId },
    select: {
      id: true,
      callName: true,
      regNumber: true,
      breedCode2: true,
      sex: true,
      birthEpoch: true,
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
    },
  });

  if (!purchasedDog) {
    throw new Error("Purchased dog not found after sale.");
  }

  await ensureFoundationInventoryForBreed({
    breedCode2: purchasedDog.breedCode2,
    currentEpoch,
  });

  await applyBetaBalanceTopUp({
    kennelId,
    currentEpoch,
  });

  return {
    listingId: "sold",
    dogId: purchasedDog.id,
    callName: purchasedDog.callName,
    regNumber: purchasedDog.regNumber,
    breedCode2: purchasedDog.breedCode2,
    breedName: purchasedDog.breed.name,
    sex: purchasedDog.sex,
    birthEpoch: purchasedDog.birthEpoch,
    ageHours: Math.max(0, currentEpoch - purchasedDog.birthEpoch),
    price: 0,
    visibleCategories: getVisibleCategoriesFromDogRecord(purchasedDog),
  };
}
