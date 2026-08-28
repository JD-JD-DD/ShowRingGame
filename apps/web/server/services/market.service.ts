import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { PersistedDogTraitRecord } from "@/server/services/phenotypePersistence.service";
import { formatDogDisplayName } from "@/lib/dogNames";
import { createKennelNotice } from "@/server/services/kennelNotice.service";
import {
  assertDogHasNoPendingVeterinaryCare,
  hasPendingVeterinaryCareForDog,
} from "@/server/services/emergencyVetCare.service";
import {
  assertDogNotProtectedByStudContractSelection,
  getStudContractPuppyProtection,
} from "@/server/services/studContractPuppyProtection.service";
import { extinguishStudContractReturnServicesForDog } from "@/server/services/studContractReturnService.service";
import { ensurePhenotypeHealthTruthsForDogs } from "@/server/services/healthTest.service";
import {
  deleteLitterRunIfEmpty,
  ensureUncategorizedKennelRun,
} from "@/server/services/kennelRun.service";
import {
  deriveCurrentVisibleCategoriesForDogDisplay,
  DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES,
} from "@/server/services/dogVisibleCategories.service";
import {
  canSellPuppy,
  type VisibleCategories,
} from "@showring/rules";

export const PLAYER_SALE_LISTING_TYPE = "PLAYER_PUBLIC";
export const PLAYER_STUD_LISTING_TYPE = "PLAYER_STUD";

export type SaleEligibilityReasonCode =
  | "DOG_NOT_FOUND"
  | "NOT_OWNED"
  | "NOT_ACTIVE"
  | "PENDING_VET_CARE"
  | "STUD_CONTRACT_SELECTION_PROTECTED"
  | "UNDER_SALE_AGE"
  | "ALREADY_LISTED"
  | "BREEDING_CONFLICT";

export type DogSaleEligibility = {
  dogId: string;
  eligible: boolean;
  reasonCode: SaleEligibilityReasonCode | null;
  reasonMessage: string | null;
};

function ineligibleDogSale(
  dogId: string,
  reasonCode: SaleEligibilityReasonCode,
  reasonMessage: string
): DogSaleEligibility {
  return { dogId, eligible: false, reasonCode, reasonMessage };
}

/**
 * Evaluates the current server-side rules for listing one player-owned dog.
 * This is a preflight only: callers that create listings must evaluate it again
 * against current state inside their write transaction.
 */
export async function getDogSaleEligibility(args: {
  dogId: string;
  sellerKennelId: string;
  currentEpoch: number;
  client?: typeof db | Prisma.TransactionClient;
}): Promise<DogSaleEligibility> {
  const client = args.client ?? db;
  const dog = await client.dog.findUnique({
    where: { id: args.dogId },
    select: {
      id: true,
      ownerKennelId: true,
      birthEpoch: true,
      lifecycleState: true,
      marketState: true,
    },
  });

  if (!dog) {
    return ineligibleDogSale(args.dogId, "DOG_NOT_FOUND", "Dog not found.");
  }
  if (dog.ownerKennelId !== args.sellerKennelId) {
    return ineligibleDogSale(dog.id, "NOT_OWNED", "You do not own this dog.");
  }
  if (dog.lifecycleState !== "ALIVE") {
    return ineligibleDogSale(
      dog.id,
      "NOT_ACTIVE",
      "Only active dogs can be offered for sale."
    );
  }
  if (await hasPendingVeterinaryCareForDog(dog.id, client)) {
    return ineligibleDogSale(
      dog.id,
      "PENDING_VET_CARE",
      "This dog is awaiting emergency veterinary care."
    );
  }

  const protection = await getStudContractPuppyProtection({
    dogId: dog.id,
    client,
  });
  if (protection.protected) {
    return ineligibleDogSale(
      dog.id,
      "STUD_CONTRACT_SELECTION_PROTECTED",
      protection.reasonCode === "SELECTED_CLAIM"
        ? "This puppy has been selected under an active Stud Contract and cannot be listed for sale yet."
        : "This puppy is part of an active Stud Contract selection and cannot be listed for sale yet."
    );
  }
  if (!canSellPuppy(args.currentEpoch, dog.birthEpoch, dog.lifecycleState)) {
    return ineligibleDogSale(
      dog.id,
      "UNDER_SALE_AGE",
      "Dogs cannot be offered for sale until 8 weeks of game age."
    );
  }
  if (dog.marketState !== "NOT_FOR_SALE") {
    return ineligibleDogSale(
      dog.id,
      "ALREADY_LISTED",
      "This dog is already listed or unavailable for sale."
    );
  }

  const activeDamBreeding = await client.breedingAttempt.findFirst({
    where: {
      damId: dog.id,
      status: { in: ["INITIATED", "PREGNANT", "REPRODUCTIVE_EMERGENCY"] },
    },
    select: { id: true },
  });
  if (activeDamBreeding) {
    return ineligibleDogSale(
      dog.id,
      "BREEDING_CONFLICT",
      "Pregnant bitches and bitches awaiting pregnancy checks cannot be listed yet."
    );
  }

  const activeListing = await client.dogListing.findFirst({
    where: { dogId: dog.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (activeListing) {
    return ineligibleDogSale(
      dog.id,
      "ALREADY_LISTED",
      "This dog already has an active listing."
    );
  }

  return { dogId: dog.id, eligible: true, reasonCode: null, reasonMessage: null };
}

type HiddenTraitRecord = PersistedDogTraitRecord;

type MarketListingRecord = {
  id: string;
  askingPrice: number;
  sellerType: "PLAYER" | "NPC" | "SYSTEM";
  listingType: string;
  sellerKennelId: string | null;
  sellerKennel: {
    name: string;
  } | null;
  dog: HiddenTraitRecord & {
    id: string;
    callName: string | null;
    registeredName: string | null;
    regNumber: string;
    visibleTitlePrefix: string | null;
    visibleTitleSuffix: string | null;
    breedCode2: string;
    sex: "M" | "F";
    birthEpoch: number;
    ownerKennelId: string | null;
    healthConditionTruths: Array<{
      conditionCode: string;
      geneticLiability: number;
      environmentModifier: number;
    }>;
    healthTests: Array<{
      testTypeCode: string;
      resultCode: string;
    }>;
    breed: {
      name: string;
    };
  };
};

type MarketHealthConditionTruth = {
  dogId: string;
  conditionCode: string;
  geneticLiability: number;
  environmentModifier: number;
};

export type MarketDogDto = {
  listingId: string;
  dogId: string;
  displayName: string;
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  breedCode2: string;
  breedName: string;
  sex: "M" | "F";
  birthEpoch: number;
  ageHours: number;
  price: number;
  sellerType: "PLAYER" | "NPC" | "SYSTEM";
  sellerKennelName: string | null;
  listingType: string;
  isOwnedByCurrentKennel: boolean;
  visibleCategories: VisibleCategories;
};

export function assertWholeDollarAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a whole dollar amount of at least $1.`);
  }
}

type PlayerSaleListingDataArgs = {
  dogId: string;
  sellerKennelId: string;
  askingPrice: number;
  currentEpoch: number;
  regNumber: string;
};

function playerSaleListingData(args: PlayerSaleListingDataArgs) {
  return {
    dogId: args.dogId,
    sellerKennelId: args.sellerKennelId,
    sellerType: "PLAYER" as const,
    askingPrice: args.askingPrice,
    listingType: PLAYER_SALE_LISTING_TYPE,
    status: "ACTIVE" as const,
    listedAtEpoch: args.currentEpoch,
    descriptionPublic: `Player listing for ${args.regNumber}.`,
  };
}

export class BulkDogSaleError extends Error {
  constructor(
    message: string,
    readonly details?: {
      failedDogId?: string;
      reasonCode?: SaleEligibilityReasonCode;
      reasonMessage?: string;
    }
  ) {
    super(message);
  }
}

export async function bulkListDogsForSale(args: {
  sellerKennelId: string;
  currentEpoch: number;
  updates: Array<{ dogId: string; askingPrice: number }>;
}): Promise<{ listedCount: number }> {
  return bulkListDogsForSaleWithClient(args, db);
}

export async function bulkListDogsForSaleWithClient(
  args: {
    sellerKennelId: string;
    currentEpoch: number;
    updates: Array<{ dogId: string; askingPrice: number }>;
  },
  client: Pick<typeof db, "$transaction"> = db
): Promise<{ listedCount: number }> {
  for (const update of args.updates) {
    assertWholeDollarAmount(update.askingPrice, "Sale price");
  }

  return client.$transaction(async (tx) => {
    for (const update of args.updates) {
      const eligibility = await getDogSaleEligibility({
        dogId: update.dogId,
        sellerKennelId: args.sellerKennelId,
        currentEpoch: args.currentEpoch,
        client: tx,
      });
      if (!eligibility.eligible) {
        throw new BulkDogSaleError(
          `No dogs were listed. ${eligibility.reasonMessage ?? "This dog is no longer eligible for sale."}`,
          {
            failedDogId: update.dogId,
            reasonCode: eligibility.reasonCode ?? undefined,
            reasonMessage: eligibility.reasonMessage ?? undefined,
          }
        );
      }
    }

    const dogs = await tx.dog.findMany({
      where: { id: { in: args.updates.map((update) => update.dogId) } },
      select: { id: true, regNumber: true },
    });
    const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
    if (dogsById.size !== args.updates.length) {
      throw new BulkDogSaleError("No dogs were listed. A selected dog could not be found.");
    }

    await tx.dogListing.createMany({
      data: args.updates.map((update) =>
        playerSaleListingData({
          dogId: update.dogId,
          sellerKennelId: args.sellerKennelId,
          askingPrice: update.askingPrice,
          currentEpoch: args.currentEpoch,
          regNumber: dogsById.get(update.dogId)!.regNumber,
        })
      ),
    });

    const marketStateUpdate = await tx.dog.updateMany({
      where: {
        id: { in: args.updates.map((update) => update.dogId) },
        ownerKennelId: args.sellerKennelId,
        lifecycleState: "ALIVE",
        marketState: "NOT_FOR_SALE",
      },
      data: { marketState: "LISTED_PLAYER" },
    });
    if (marketStateUpdate.count !== args.updates.length) {
      throw new BulkDogSaleError("No dogs were listed. A selected dog is no longer eligible for sale.");
    }

    return { listedCount: args.updates.length };
  });
}

function mapMarketListing(args: {
  listing: MarketListingRecord;
  currentEpoch: number;
  currentKennelId?: string | null;
  healthConditionTruths?: MarketListingRecord["dog"]["healthConditionTruths"];
}): MarketDogDto {
  const { listing, currentEpoch, currentKennelId } = args;
  const healthConditionTruths =
    args.healthConditionTruths ?? listing.dog.healthConditionTruths;

  return {
    listingId: listing.id,
    dogId: listing.dog.id,
    displayName: formatDogDisplayName(listing.dog),
    callName: listing.dog.callName,
    registeredName: listing.dog.registeredName,
    regNumber: listing.dog.regNumber,
    visibleTitlePrefix: listing.dog.visibleTitlePrefix,
    visibleTitleSuffix: listing.dog.visibleTitleSuffix,
    breedCode2: listing.dog.breedCode2,
    breedName: listing.dog.breed.name,
    sex: listing.dog.sex,
    birthEpoch: listing.dog.birthEpoch,
    ageHours: Math.max(0, currentEpoch - listing.dog.birthEpoch),
    price: listing.askingPrice,
    sellerType: listing.sellerType,
    sellerKennelName: listing.sellerKennel?.name ?? null,
    listingType: listing.listingType,
    isOwnedByCurrentKennel: listing.dog.ownerKennelId === currentKennelId,
    visibleCategories: deriveCurrentVisibleCategoriesForDogDisplay({
      storedTraits: listing.dog,
      phenotypeHealthTruths: healthConditionTruths,
      phenotypeHealthResults: listing.dog.healthTests,
    }),
  };
}

function groupHealthConditionTruthsByDog(
  healthConditionTruths: MarketHealthConditionTruth[]
) {
  const truthsByDogId = new Map<
    string,
    MarketListingRecord["dog"]["healthConditionTruths"]
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

export async function listMarketDogs(args: {
  breedCode2?: string;
  currentEpoch: number;
  currentKennelId?: string | null;
}): Promise<MarketDogDto[]> {
  const { breedCode2, currentEpoch, currentKennelId } = args;
  const dogBreedFilter = breedCode2 ? { breedCode2 } : {};
  const listings = await db.dogListing.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        {
          sellerType: "SYSTEM",
          dog: {
            ...dogBreedFilter,
            lifecycleState: "ALIVE",
            isPlayerVisible: true,
            marketState: "LISTED_NPC",
            ownerKennelId: null,
          },
        },
        {
          sellerType: "PLAYER",
          listingType: PLAYER_SALE_LISTING_TYPE,
          dog: {
            ...dogBreedFilter,
            lifecycleState: "ALIVE",
            isPlayerVisible: true,
            marketState: "LISTED_PLAYER",
            ownerKennelId: {
              not: null,
            },
          },
        },
      ],
    },
    orderBy: [
      { dog: { breedCode2: "asc" } },
      { sellerType: "asc" },
      { listedAtEpoch: "desc" },
      { askingPrice: "asc" },
    ],
    select: {
      id: true,
      askingPrice: true,
      sellerType: true,
      listingType: true,
      sellerKennelId: true,
      sellerKennel: {
        select: {
          name: true,
        },
      },
      dog: {
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

  const dogIds = listings.map((listing) => listing.dog.id);

  if (dogIds.length > 0) {
    await ensurePhenotypeHealthTruthsForDogs(db, dogIds);
  }

  const healthConditionTruths = dogIds.length
    ? await db.dogHealthConditionTruth.findMany({
        where: {
          dogId: {
            in: dogIds,
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
      })
    : [];
  const healthConditionTruthsByDogId =
    groupHealthConditionTruthsByDog(healthConditionTruths);

  return listings.map((listing) =>
    mapMarketListing({
      listing,
      currentEpoch,
      currentKennelId,
      healthConditionTruths:
        healthConditionTruthsByDogId.get(listing.dog.id) ??
        listing.dog.healthConditionTruths,
    })
  );
}

export async function listDogForSale(args: {
  dogId: string;
  sellerKennelId: string;
  currentEpoch: number;
  askingPrice: number;
}): Promise<string> {
  const { dogId, sellerKennelId, currentEpoch, askingPrice } = args;

  assertWholeDollarAmount(askingPrice, "Sale price");
  return db.$transaction(async (tx) => {
    const eligibility = await getDogSaleEligibility({
      dogId,
      sellerKennelId,
      currentEpoch,
      client: tx,
    });
    if (!eligibility.eligible) {
      throw new Error(eligibility.reasonMessage ?? "Dog cannot be offered for sale.");
    }

    const dog = await tx.dog.findUnique({
      where: { id: dogId },
      select: { id: true, regNumber: true },
    });
    if (!dog) throw new Error("Dog not found.");

    const listing = await tx.dogListing.create({
      data: playerSaleListingData({
        dogId: dog.id,
        sellerKennelId,
        askingPrice,
        currentEpoch,
        regNumber: dog.regNumber,
      }),
      select: {
        id: true,
      },
    });

    await tx.dog.update({
      where: { id: dog.id },
      data: {
        marketState: "LISTED_PLAYER",
      },
    });

    return listing.id;
  });
}

export async function buyPlayerDogListing(args: {
  listingId: string;
  buyerKennelId: string;
  currentEpoch: number;
}): Promise<string> {
  const { listingId, buyerKennelId, currentEpoch } = args;

  const listingDog = await db.dogListing.findUnique({
    where: { id: listingId },
    select: { dogId: true },
  });

  return db.$transaction(async (tx) => {
    const listing = await tx.dogListing.findFirst({
      where: {
        id: listingId,
        sellerType: "PLAYER",
        listingType: PLAYER_SALE_LISTING_TYPE,
        status: "ACTIVE",
      },
      select: {
        id: true,
        sellerKennelId: true,
        askingPrice: true,
        dog: {
          select: {
            id: true,
            regNumber: true,
            registeredName: true,
            callName: true,
            visibleTitlePrefix: true,
            visibleTitleSuffix: true,
            ownerKennelId: true,
            kennelRunId: true,
            lifecycleState: true,
            marketState: true,
          },
        },
      },
    });

    if (!listing || !listing.sellerKennelId) {
      throw new Error("Player listing not found.");
    }

    if (listing.sellerKennelId === buyerKennelId) {
      throw new Error("You already own this dog.");
    }

    if (
      listing.dog.ownerKennelId !== listing.sellerKennelId ||
      listing.dog.lifecycleState !== "ALIVE" ||
      listing.dog.marketState !== "LISTED_PLAYER"
    ) {
      throw new Error("This dog is no longer available for sale.");
    }

    await assertDogHasNoPendingVeterinaryCare(listing.dog.id, tx);
    await assertDogNotProtectedByStudContractSelection({ dogId: listing.dog.id, action: "transferred", client: tx });

    const [buyer, seller] = await Promise.all([
      tx.kennel.findUnique({
        where: { id: buyerKennelId },
        select: { id: true, name: true, balance: true },
      }),
      tx.kennel.findUnique({
        where: { id: listing.sellerKennelId },
        select: { id: true, balance: true },
      }),
    ]);

    if (!buyer) {
      throw new Error("Buyer kennel not found.");
    }

    if (!seller) {
      throw new Error("Seller kennel not found.");
    }

    if (buyer.balance < listing.askingPrice) {
      throw new Error("Insufficient funds.");
    }

    const buyerKennelRun = await ensureUncategorizedKennelRun({
      kennelId: buyer.id,
      client: tx,
    });
    const buyerBalanceAfter = buyer.balance - listing.askingPrice;
    const sellerBalanceAfter = seller.balance + listing.askingPrice;

    await tx.kennel.update({
      where: { id: buyer.id },
      data: { balance: buyerBalanceAfter },
    });

    await tx.kennel.update({
      where: { id: seller.id },
      data: { balance: sellerBalanceAfter },
    });

    await tx.ledgerTransaction.create({
      data: {
        kennelId: buyer.id,
        transactionType: "DOG_PURCHASE",
        amount: -listing.askingPrice,
        balanceAfter: buyerBalanceAfter,
        occurredAtEpoch: currentEpoch,
        dogId: listing.dog.id,
        counterpartyKennelId: seller.id,
        memo: `Purchased dog ${listing.dog.regNumber}`,
      },
    });

    await tx.ledgerTransaction.create({
      data: {
        kennelId: seller.id,
        transactionType: "DOG_SALE",
        amount: listing.askingPrice,
        balanceAfter: sellerBalanceAfter,
        occurredAtEpoch: currentEpoch,
        dogId: listing.dog.id,
        counterpartyKennelId: buyer.id,
        memo: `Sold dog ${listing.dog.regNumber}`,
      },
    });

    await tx.dog.update({
      where: { id: listing.dog.id },
      data: {
        ownerKennelId: buyer.id,
        kennelRunId: buyerKennelRun.id,
        marketState: "NOT_FOR_SALE",
        isBreedingActive: true,
      },
    });
    await extinguishStudContractReturnServicesForDog({
      client: tx,
      dogId: listing.dog.id,
      extinguishedAt: new Date(),
      sireReason: "SIRE_OWNERSHIP_CHANGED",
      damReason: "DAM_OWNERSHIP_CHANGED",
    });
    await deleteLitterRunIfEmpty({
      priorRunId: listing.dog.kennelRunId,
      client: tx,
    });

    await tx.dogListing.update({
      where: { id: listing.id },
      data: {
        status: "SOLD",
        soldAtEpoch: currentEpoch,
        buyerKennelId: buyer.id,
      },
    });

    await createKennelNotice({
      client: tx,
      kennelId: seller.id,
      type: "DOG_SOLD",
      title: "Dog sold",
      body: `${formatDogDisplayName(listing.dog)} sold to ${buyer.name} for $${listing.askingPrice.toLocaleString()}.`,
      currentEpoch,
      linkedDogId: listing.dog.id,
      linkedListingId: listing.id,
    });

    return listing.dog.id;
  });
}

export async function updatePlayerDogListingPrice(args: {
  listingId: string;
  sellerKennelId: string;
  askingPrice: number;
}): Promise<string> {
  const { listingId, sellerKennelId, askingPrice } = args;

  assertWholeDollarAmount(askingPrice, "Sale price");

  return db.$transaction(async (tx) => {
    const listing = await tx.dogListing.findFirst({
      where: {
        id: listingId,
        sellerType: "PLAYER",
        listingType: PLAYER_SALE_LISTING_TYPE,
        status: "ACTIVE",
      },
      select: {
        id: true,
        sellerKennelId: true,
        dog: {
          select: {
            id: true,
            ownerKennelId: true,
            lifecycleState: true,
            marketState: true,
          },
        },
      },
    });

    if (!listing || listing.sellerKennelId !== sellerKennelId) {
      throw new Error("Player listing not found.");
    }

    if (
      listing.dog.ownerKennelId !== sellerKennelId ||
      listing.dog.lifecycleState !== "ALIVE" ||
      listing.dog.marketState !== "LISTED_PLAYER"
    ) {
      throw new Error("This dog is no longer available for listing changes.");
    }

    await tx.dogListing.update({
      where: { id: listing.id },
      data: {
        askingPrice,
      },
    });

    return listing.dog.id;
  });
}

export async function cancelPlayerDogListing(args: {
  listingId: string;
  sellerKennelId: string;
}): Promise<string> {
  const { listingId, sellerKennelId } = args;

  return db.$transaction(async (tx) => {
    const listing = await tx.dogListing.findFirst({
      where: {
        id: listingId,
        sellerType: "PLAYER",
        listingType: PLAYER_SALE_LISTING_TYPE,
        status: "ACTIVE",
      },
      select: {
        id: true,
        sellerKennelId: true,
        dog: {
          select: {
            id: true,
            ownerKennelId: true,
            lifecycleState: true,
            marketState: true,
          },
        },
      },
    });

    if (!listing || listing.sellerKennelId !== sellerKennelId) {
      throw new Error("Player listing not found.");
    }

    if (
      listing.dog.ownerKennelId !== sellerKennelId ||
      listing.dog.lifecycleState !== "ALIVE" ||
      listing.dog.marketState !== "LISTED_PLAYER"
    ) {
      throw new Error("This dog is no longer available for listing changes.");
    }

    await tx.dogListing.update({
      where: { id: listing.id },
      data: {
        status: "CANCELLED",
      },
    });

    await tx.dog.update({
      where: { id: listing.dog.id },
      data: {
        marketState: "NOT_FOR_SALE",
      },
    });

    return listing.dog.id;
  });
}

export async function updatePlayerStudListingPrice(args: {
  listingId: string;
  sellerKennelId: string;
  studFeeAmount: number;
}): Promise<string> {
  const { listingId, sellerKennelId, studFeeAmount } = args;

  assertWholeDollarAmount(studFeeAmount, "Stud fee");

  return db.$transaction(async (tx) => {
    const listing = await tx.dogListing.findFirst({
      where: {
        id: listingId,
        sellerType: "PLAYER",
        listingType: PLAYER_STUD_LISTING_TYPE,
        status: "ACTIVE",
      },
      select: {
        id: true,
        sellerKennelId: true,
        dog: {
          select: {
            id: true,
            ownerKennelId: true,
            lifecycleState: true,
          },
        },
      },
    });

    if (!listing || listing.sellerKennelId !== sellerKennelId) {
      throw new Error("Stud listing not found.");
    }

    if (
      listing.dog.ownerKennelId !== sellerKennelId ||
      listing.dog.lifecycleState !== "ALIVE"
    ) {
      throw new Error("This dog is no longer available for stud listing changes.");
    }

    await tx.dogListing.update({
      where: { id: listing.id },
      data: {
        askingPrice: studFeeAmount,
      },
    });

    return listing.dog.id;
  });
}

export async function cancelPlayerStudListing(args: {
  listingId: string;
  sellerKennelId: string;
}): Promise<string> {
  const { listingId, sellerKennelId } = args;

  return db.$transaction(async (tx) => {
    const listing = await tx.dogListing.findFirst({
      where: {
        id: listingId,
        sellerType: "PLAYER",
        listingType: PLAYER_STUD_LISTING_TYPE,
        status: "ACTIVE",
      },
      select: {
        id: true,
        sellerKennelId: true,
        dog: {
          select: {
            id: true,
            ownerKennelId: true,
            lifecycleState: true,
          },
        },
      },
    });

    if (!listing || listing.sellerKennelId !== sellerKennelId) {
      throw new Error("Stud listing not found.");
    }

    if (
      listing.dog.ownerKennelId !== sellerKennelId ||
      listing.dog.lifecycleState !== "ALIVE"
    ) {
      throw new Error("This dog is no longer available for stud listing changes.");
    }

    await tx.dogListing.update({
      where: { id: listing.id },
      data: {
        status: "CANCELLED",
      },
    });

    return listing.dog.id;
  });
}
