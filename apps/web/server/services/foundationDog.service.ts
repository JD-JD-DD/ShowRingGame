import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  toGameplayPhenotype,
  toPersistedDogTraits,
  type PersistedDogTraitRecord,
} from "@/server/services/phenotypePersistence.service";
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
import { isDogRegistrationCollision, reserveDogRegistrations } from "@/server/services/dogRegistration.service";
import { assessDisposableFoundationInventoryDog } from "@/server/services/disposableFoundationInventory.service";
import { resolveFoundationPopulationContext, type FoundationPopulationContext } from "@/server/services/foundationPopulationContext.service";
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

type FoundationInventoryCountClient = Pick<Prisma.TransactionClient, "dog">;

export async function countUnsoldFoundationFemalesByBreed(
  breedCode2: string,
  client: FoundationInventoryCountClient = db
): Promise<number> {
  return client.dog.count({
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
  breedCode2: string,
  client: FoundationInventoryCountClient = db
): Promise<number> {
  return client.dog.count({
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

type HiddenTraitRecord = PersistedDogTraitRecord;

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

type FoundationHealthConditionTruth = {
  dogId: string;
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
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
  healthConditionTruths?: MarketDogRecord["healthConditionTruths"];
}): FoundationDogMarketDto {
  const { listingId, price, dog, currentEpoch } = args;
  const healthConditionTruths =
    args.healthConditionTruths ?? dog.healthConditionTruths;

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
  visibleCategories: getVisibleCategoriesFromDogRecord({
    ...dog,
    healthConditionTruths,
  }),
  };
}

function groupHealthConditionTruthsByDog(
  healthConditionTruths: FoundationHealthConditionTruth[]
) {
  const truthsByDogId = new Map<
    string,
    MarketDogRecord["healthConditionTruths"]
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

async function ensureAndLoadFoundationDisplayHealthTruths(dogIds: string[]) {
  const uniqueDogIds = [...new Set(dogIds)];

  if (uniqueDogIds.length === 0) {
    return new Map<string, MarketDogRecord["healthConditionTruths"]>();
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
      head: Number(average(rows.map((row) => toGameplayPhenotype(row.traitHead))).toFixed(2)),
      forequarters: Number(
        average(rows.map((row) => toGameplayPhenotype(row.traitForequarters))).toFixed(2)
      ),
      hindquarters: Number(
        average(rows.map((row) => toGameplayPhenotype(row.traitHindquarters))).toFixed(2)
      ),
      gait: Number(average(rows.map((row) => toGameplayPhenotype(row.traitGait))).toFixed(2)),
      coat: Number(average(rows.map((row) => toGameplayPhenotype(row.traitCoat))).toFixed(2)),
      size: Number(average(rows.map((row) => toGameplayPhenotype(row.traitSize))).toFixed(2)),
      temperament: Number(
        average(rows.map((row) => toGameplayPhenotype(row.traitTemperament))).toFixed(2)
      ),
      show_shine: Number(
        average(rows.map((row) => toGameplayPhenotype(row.traitShowShine))).toFixed(2)
      ),
      feet: Number(average(rows.map((row) => toGameplayPhenotype(row.traitFeet))).toFixed(2)),
      topline: Number(average(rows.map((row) => toGameplayPhenotype(row.traitTopline))).toFixed(2)),
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

    const existing = await db.dogRegistrationReservation.findUnique({
      where: { regNumber },
      select: { regNumber: true },
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


type PreparedFoundationDog = {
  generated: ReturnType<typeof createFoundationDogProfile>;
  litterOrder: number;
  askingPrice: number;
};

async function prepareFoundationDog(args: {
  breedCode2: string;
  currentEpoch: number;
  populationContext?: FoundationPopulationContext;
}): Promise<PreparedFoundationDog> {
  const { breedCode2, currentEpoch } = args;

  const breedBaseline = { breedCode2, traitMeans: GLOBAL_FALLBACK_BASELINE };
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
    populationContext: args.populationContext,
  });

  const askingPrice = await calculateFoundationAskingPrice({
    breedCode2,
    currentEpoch,
    suggestedPrice: generated.suggestedPrice,
  });

  return { generated, litterOrder, askingPrice };
}

async function persistPreparedFoundationDog(args: {
  tx: Prisma.TransactionClient;
  prepared: PreparedFoundationDog;
  currentEpoch: number;
  forcedSex?: "M" | "F";
}): Promise<void> {
  const { tx, prepared, currentEpoch } = args;
  const { generated, litterOrder, askingPrice } = prepared;
  const finalSex = args.forcedSex ?? generated.dog.sex;

  await reserveDogRegistrations(tx, [generated.dog.regNumber]);
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
        genotype: generated.dog.genotype,
        geneticsVersion: generated.dog.geneticsVersion,

        ...toPersistedDogTraits(generated.dog.traits),
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
}

async function createOneFoundationDog(args: {
  breedCode2: string;
  currentEpoch: number;
  forcedSex?: "M" | "F";
  populationContext?: FoundationPopulationContext;
  allocationAttempt?: number;
}): Promise<void> {
  const allocationAttempt = args.allocationAttempt ?? 0;
  try {
    const prepared = await prepareFoundationDog(args);
    await db.$transaction((tx) =>
      persistPreparedFoundationDog({
        tx,
        prepared,
        currentEpoch: args.currentEpoch,
        forcedSex: args.forcedSex,
      })
    );
  } catch (error) {
    if (isDogRegistrationCollision(error) && allocationAttempt < 99) {
      await createOneFoundationDog({ ...args, allocationAttempt: allocationAttempt + 1 });
      return;
    }
    throw error;
  }
}

type FoundationInventoryCleanupResult = {
  expiredCount: number;
  deletedDogCount: number;
  protectedCount: number;
  skippedCount: number;
};

type ExpiredFoundationInventoryCandidate = {
  listingId: string;
  dogId: string;
};

class FoundationInventoryCleanupSkipped extends Error {}

export async function cleanupExpiredFoundationInventoryCandidateInTransaction(
  tx: Prisma.TransactionClient,
  args: {
  candidate: ExpiredFoundationInventoryCandidate;
  currentEpoch: number;
  }
): Promise<
  | "EXPIRED"
  | "DELETED_AFTER_EXPIRATION"
  | "DELETED"
  | "PROTECTED_AFTER_EXPIRATION"
  | "PROTECTED"
  | "SKIPPED"
> {
  const { candidate, currentEpoch } = args;
      const listing = await tx.dogListing.findUnique({
        where: { id: candidate.listingId },
        select: {
          id: true,
          dogId: true,
          sellerType: true,
          listingType: true,
          status: true,
          expiresAtEpoch: true,
          dog: {
            select: {
              breedCode2: true,
              ownerKennelId: true,
              lifecycleState: true,
              marketState: true,
              originType: true,
              isFoundation: true,
            },
          },
        },
      });

      if (
        !listing ||
        listing.dogId !== candidate.dogId ||
        listing.sellerType !== "SYSTEM" ||
        listing.listingType !== FOUNDATION_LISTING_TYPE ||
        listing.expiresAtEpoch === null ||
        listing.expiresAtEpoch > currentEpoch ||
        listing.dog.ownerKennelId !== null ||
        listing.dog.lifecycleState !== "ALIVE" ||
        listing.dog.originType !== "FOUNDATION" ||
        !listing.dog.isFoundation
      ) {
        return "SKIPPED";
      }

      let expiredThisCall = false;
      if (listing.status === "ACTIVE") {
        if (listing.dog.marketState !== "LISTED_NPC") {
          return "SKIPPED";
        }

        const expired = await tx.dogListing.updateMany({
          where: {
            id: listing.id,
            sellerType: "SYSTEM",
            listingType: FOUNDATION_LISTING_TYPE,
            status: "ACTIVE",
            expiresAtEpoch: { lte: currentEpoch },
          },
          data: {
            status: "EXPIRED",
            expiresAtEpoch: currentEpoch,
          },
        });
        if (expired.count !== 1) {
          return "SKIPPED";
        }

        const dogExpired = await tx.dog.updateMany({
          where: {
            id: listing.dogId,
            ownerKennelId: null,
            lifecycleState: "ALIVE",
            marketState: "LISTED_NPC",
            originType: "FOUNDATION",
            isFoundation: true,
          },
          data: { marketState: "NOT_FOR_SALE" },
        });
        if (dogExpired.count !== 1) {
          throw new FoundationInventoryCleanupSkipped();
        }
        expiredThisCall = true;
      } else if (
        listing.status !== "EXPIRED" ||
        listing.dog.marketState !== "NOT_FOR_SALE"
      ) {
        return "SKIPPED";
      }

      const assessment = await assessDisposableFoundationInventoryDog(tx, listing.dogId);
      if (assessment.status === "PROTECTED") {
        console.info("foundation-inventory-cleanup-retained", {
          dogId: listing.dogId,
          breedCode2: listing.dog.breedCode2,
          listingIds: [listing.id],
          assessmentStatus: assessment.status,
          protectedReasons: assessment.protectedReasons,
        });
        return expiredThisCall ? "PROTECTED_AFTER_EXPIRATION" : "PROTECTED";
      }
      if (assessment.status !== "DISPOSABLE") {
        return expiredThisCall ? "EXPIRED" : "SKIPPED";
      }

      const children = assessment.disposableSystemChildren;
      // These are the exact FOUNDATION-03-approved rows, deleted before the Dog.
      await tx.dogEmergencyCareEvent.deleteMany({
        where: { id: { in: children.pendingSystemEmergencyCareEventIds } },
      });
      await tx.dogInfectiousDiseaseStatus.deleteMany({
        where: { id: { in: children.foundationDiseaseStatusIds } },
      });
      await tx.dogHealthConditionTruth.deleteMany({
        where: { id: { in: children.healthConditionTruthIds } },
      });
      await tx.dogListing.deleteMany({
        where: {
          id: { in: children.expiredFoundationListingIds },
          dogId: listing.dogId,
          sellerType: "SYSTEM",
          listingType: FOUNDATION_LISTING_TYPE,
          status: "EXPIRED",
        },
      });
      await tx.dog.delete({ where: { id: listing.dogId } });

      return expiredThisCall ? "DELETED_AFTER_EXPIRATION" : "DELETED";
}

async function cleanupExpiredFoundationInventoryCandidate(args: {
  candidate: ExpiredFoundationInventoryCandidate;
  currentEpoch: number;
}): Promise<
  | "EXPIRED"
  | "DELETED_AFTER_EXPIRATION"
  | "DELETED"
  | "PROTECTED_AFTER_EXPIRATION"
  | "PROTECTED"
  | "SKIPPED"
> {
  const { candidate } = args;
  try {
    return await db.$transaction((tx) =>
      cleanupExpiredFoundationInventoryCandidateInTransaction(tx, args)
    );
  } catch (error) {
    if (error instanceof FoundationInventoryCleanupSkipped) {
      return "SKIPPED";
    }
    console.error("foundation-inventory-cleanup-failed", {
      dogId: candidate.dogId,
      listingIds: [candidate.listingId],
      cleanupStage: "candidate-transaction",
      error,
    });
    return "SKIPPED";
  }
}

export async function cleanupExpiredDisposableFoundationInventory(args: {
  currentEpoch: number;
  breedCode2?: string;
}): Promise<FoundationInventoryCleanupResult> {
  const { currentEpoch, breedCode2 } = args;
  const candidates = await db.dogListing.findMany({
    where: {
      sellerType: "SYSTEM",
      listingType: FOUNDATION_LISTING_TYPE,
      expiresAtEpoch: { lte: currentEpoch },
      OR: [
        {
          status: "ACTIVE",
          dog: {
            ownerKennelId: null,
            lifecycleState: "ALIVE",
            marketState: "LISTED_NPC",
            originType: "FOUNDATION",
            isFoundation: true,
            ...(breedCode2 ? { breedCode2 } : {}),
          },
        },
        {
          status: "EXPIRED",
          dog: {
            ownerKennelId: null,
            lifecycleState: "ALIVE",
            marketState: "NOT_FOR_SALE",
            originType: "FOUNDATION",
            isFoundation: true,
            ...(breedCode2 ? { breedCode2 } : {}),
          },
        },
      ],
    },
    select: { id: true, dogId: true },
  });

  const result: FoundationInventoryCleanupResult = {
    expiredCount: 0,
    deletedDogCount: 0,
    protectedCount: 0,
    skippedCount: 0,
  };
  for (const candidate of candidates) {
    const outcome = await cleanupExpiredFoundationInventoryCandidate({
      candidate: { listingId: candidate.id, dogId: candidate.dogId },
      currentEpoch,
    });
    if (outcome === "EXPIRED") result.expiredCount += 1;
    if (outcome === "DELETED_AFTER_EXPIRATION") {
      result.deletedDogCount += 1;
      result.expiredCount += 1;
    }
    if (outcome === "DELETED") result.deletedDogCount += 1;
    if (outcome === "PROTECTED_AFTER_EXPIRATION") {
      result.protectedCount += 1;
      result.expiredCount += 1;
    }
    if (outcome === "PROTECTED") result.protectedCount += 1;
    if (outcome === "SKIPPED") result.skippedCount += 1;
  }
  return result;
}

export async function expireStaleFoundationListings(args: {
  currentEpoch: number;
  breedCode2?: string;
}): Promise<number> {
  const result = await cleanupExpiredDisposableFoundationInventory(args);
  return result.expiredCount;
}

export async function countUnsoldFoundationDogsByBreed(
  breedCode2: string,
  client: FoundationInventoryCountClient = db
): Promise<number> {
  return client.dog.count({
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

/**
 * PostgreSQL transaction-scoped advisory locks are process-independent and
 * release automatically on commit/rollback. `hashtextextended` deterministically
 * maps the canonical breed code to PostgreSQL's bigint lock space; collisions
 * can only cause harmless extra serialization between two breeds.
 */
async function withFoundationInventoryBreedLock<T>(args: {
  breedCode2: string;
  operation: (tx: Prisma.TransactionClient) => Promise<T>;
}): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${args.breedCode2}, 0))
    `;
    return args.operation(tx);
  });
}

type FoundationInventoryState = {
  currentCount: number;
  currentFemaleCount: number;
  currentMaleCount: number;
};

async function getLockedFoundationInventoryState(args: {
  breedCode2: string;
}): Promise<FoundationInventoryState> {
  return withFoundationInventoryBreedLock({
    breedCode2: args.breedCode2,
    operation: async (tx) => {
      const [currentCount, currentFemaleCount, currentMaleCount] =
        await Promise.all([
          countUnsoldFoundationDogsByBreed(args.breedCode2, tx),
          countUnsoldFoundationFemalesByBreed(args.breedCode2, tx),
          countUnsoldFoundationMalesByBreed(args.breedCode2, tx),
        ]);
      return { currentCount, currentFemaleCount, currentMaleCount };
    },
  });
}

function getFoundationInventoryCreateCount(args: {
  state: FoundationInventoryState;
  targetInventory: number;
}): number {
  const femalesNeeded = Math.max(
    0,
    FOUNDATION_MIN_ACTIVE_FEMALES - args.state.currentFemaleCount
  );
  const malesNeeded = Math.max(
    0,
    FOUNDATION_MIN_ACTIVE_MALES - args.state.currentMaleCount
  );
  return Math.max(
    args.targetInventory - args.state.currentCount,
    femalesNeeded + malesNeeded
  );
}

function getFoundationInventoryForcedSex(args: {
  state: FoundationInventoryState;
  preferredSex?: "M" | "F";
}): "M" | "F" | undefined {
  if (args.state.currentFemaleCount < FOUNDATION_MIN_ACTIVE_FEMALES) {
    return "F";
  }
  if (args.state.currentMaleCount < FOUNDATION_MIN_ACTIVE_MALES) {
    return "M";
  }
  return args.preferredSex;
}

async function createOneFoundationDogForInventory(args: {
  breedCode2: string;
  currentEpoch: number;
  targetInventory: number;
  preferredSex?: "M" | "F";
  populationContext: FoundationPopulationContext;
  allocationAttempt?: number;
}): Promise<boolean> {
  const allocationAttempt = args.allocationAttempt ?? 0;
  try {
    // Identity, pricing, and profile generation deliberately happen before the
    // lock-bearing transaction. A later locked recheck decides whether this
    // prepared dog is still needed.
    const prepared = await prepareFoundationDog(args);
    return await withFoundationInventoryBreedLock({
      breedCode2: args.breedCode2,
      operation: async (tx) => {
        const state = await getLockedFoundationInventoryStateFromTransaction({
          breedCode2: args.breedCode2,
          tx,
        });
        if (
          getFoundationInventoryCreateCount({
            state,
            targetInventory: args.targetInventory,
          }) === 0
        ) {
          return false;
        }
        await persistPreparedFoundationDog({
          tx,
          prepared,
          currentEpoch: args.currentEpoch,
          forcedSex: getFoundationInventoryForcedSex({
            state,
            preferredSex: args.preferredSex,
          }),
        });
        return true;
      },
    });
  } catch (error) {
    if (isDogRegistrationCollision(error) && allocationAttempt < 99) {
      return createOneFoundationDogForInventory({
        ...args,
        allocationAttempt: allocationAttempt + 1,
      });
    }
    throw error;
  }
}

async function getLockedFoundationInventoryStateFromTransaction(args: {
  breedCode2: string;
  tx: Prisma.TransactionClient;
}): Promise<FoundationInventoryState> {
  const [currentCount, currentFemaleCount, currentMaleCount] =
    await Promise.all([
      countUnsoldFoundationDogsByBreed(args.breedCode2, args.tx),
      countUnsoldFoundationFemalesByBreed(args.breedCode2, args.tx),
      countUnsoldFoundationMalesByBreed(args.breedCode2, args.tx),
    ]);
  return { currentCount, currentFemaleCount, currentMaleCount };
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

  try {
    const [policy, populationContext] = await Promise.all([
      getFoundationPolicyForBreed({ breedCode2, currentEpoch }),
      resolveFoundationPopulationContext(breedCode2),
    ]);
    const targetInventory = getEffectiveFoundationTarget(policy);
    const initialState = await getLockedFoundationInventoryState({ breedCode2 });
    const createCount = getFoundationInventoryCreateCount({
      state: initialState,
      targetInventory,
    });

    const forcedSexes = buildForcedFoundationSexes({
      femalesNeeded: Math.max(
        0,
        FOUNDATION_MIN_ACTIVE_FEMALES - initialState.currentFemaleCount
      ),
      malesNeeded: Math.max(
        0,
        FOUNDATION_MIN_ACTIVE_MALES - initialState.currentMaleCount
      ),
      totalCount: createCount,
    });
    let createdCount = 0;
    for (const preferredSex of forcedSexes) {
      if (await createOneFoundationDogForInventory({
        breedCode2,
        currentEpoch,
        targetInventory,
        preferredSex,
        populationContext,
      })) {
        createdCount += 1;
      }
    }

    const finalState = await getLockedFoundationInventoryState({ breedCode2 });
    const { currentCount: finalCount, currentFemaleCount: finalFemaleCount, currentMaleCount: finalMaleCount } = finalState;
      if (
        finalCount < targetInventory ||
        finalFemaleCount < FOUNDATION_MIN_ACTIVE_FEMALES ||
        finalMaleCount < FOUNDATION_MIN_ACTIVE_MALES
      ) {
        console.error("foundation-inventory-maintenance-incomplete", {
          breedCode2,
          currentCount: initialState.currentCount,
          currentFemaleCount: initialState.currentFemaleCount,
          currentMaleCount: initialState.currentMaleCount,
          targetInventory,
          createdCount,
          finalCount,
          finalFemaleCount,
          finalMaleCount,
        });
      }
  } catch (error) {
    console.error("foundation-inventory-maintenance-failed", {
      breedCode2,
      cleanupStage: "breed-serialization",
      error,
    });
    throw error;
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
  const populationContext = await resolveFoundationPopulationContext(breedCode2);

  for (const forcedSex of forcedSexes) {
    await createOneFoundationDog({
      breedCode2,
      currentEpoch,
      forcedSex,
      populationContext,
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

  const healthConditionTruthsByDogId =
    await ensureAndLoadFoundationDisplayHealthTruths(
      listings.map((listing) => listing.dog.id)
    );

  return listings.map((listing) =>
    toFoundationDogMarketDto({
      listingId: listing.id,
      price: listing.askingPrice,
      dog: listing.dog,
      currentEpoch,
      healthConditionTruths:
        healthConditionTruthsByDogId.get(listing.dog.id) ??
        listing.dog.healthConditionTruths,
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

  const healthConditionTruthsByDogId =
    await ensureAndLoadFoundationDisplayHealthTruths([listing.dog.id]);

  return toFoundationDogMarketDto({
    listingId: listing.id,
    price: listing.askingPrice,
    dog: listing.dog,
    currentEpoch,
    healthConditionTruths:
      healthConditionTruthsByDogId.get(listing.dog.id) ??
      listing.dog.healthConditionTruths,
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
        isBreedingActive: true,
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

  const healthConditionTruthsByDogId =
    await ensureAndLoadFoundationDisplayHealthTruths([purchasedDog.id]);
  const healthConditionTruths =
    healthConditionTruthsByDogId.get(purchasedDog.id) ??
    purchasedDog.healthConditionTruths;

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
    visibleCategories: getVisibleCategoriesFromDogRecord({
      ...purchasedDog,
      healthConditionTruths,
    }),
  };
}
