import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getVisibleCategoriesFromDogRecord } from "@/server/services/foundationDog.service";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import {
  canSellPuppy,
  MIN_BREED_AGE_HOURS,
  type VisibleCategories,
} from "@showring/rules";

export const PLAYER_SALE_LISTING_TYPE = "PLAYER_PUBLIC";
export const PLAYER_STUD_LISTING_TYPE = "PLAYER_STUD";

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
    breed: {
      name: string;
    };
  };
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

function assertWholeDollarAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a whole dollar amount of at least $1.`);
  }
}

function mapMarketListing(args: {
  listing: MarketListingRecord;
  currentEpoch: number;
  currentKennelId?: string | null;
}): MarketDogDto {
  const { listing, currentEpoch, currentKennelId } = args;

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
    visibleCategories: getVisibleCategoriesFromDogRecord(listing.dog),
  };
}

export async function listMarketDogs(args: {
  breedCode2?: string;
  currentEpoch: number;
  currentKennelId?: string | null;
}): Promise<MarketDogDto[]> {
  const { breedCode2, currentEpoch, currentKennelId } = args;
  const dogBreedFilter = breedCode2 ? { breedCode2 } : {};
  const activeListedDogs = await db.dogListing.findMany({
    where: {
      status: "ACTIVE",
      dog: dogBreedFilter,
    },
    select: {
      dogId: true,
    },
  });

  await resolveDogDeaths({
    currentEpoch,
    dogIds: activeListedDogs.map((listing) => listing.dogId),
  });

  const listings = await db.dogListing.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        {
          sellerType: "SYSTEM",
          dog: {
            ...dogBreedFilter,
            lifecycleState: "ALIVE",
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
        },
      },
    },
  });

  return listings.map((listing) =>
    mapMarketListing({
      listing,
      currentEpoch,
      currentKennelId,
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
  await resolveDogDeaths({ currentEpoch, dogIds: [dogId] });

  return db.$transaction(async (tx) => {
    const dog = await tx.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        regNumber: true,
        ownerKennelId: true,
        birthEpoch: true,
        lifecycleState: true,
        marketState: true,
      },
    });

    if (!dog) {
      throw new Error("Dog not found.");
    }

    if (dog.ownerKennelId !== sellerKennelId) {
      throw new Error("You do not own this dog.");
    }

    if (dog.lifecycleState !== "ALIVE") {
      throw new Error("Only active dogs can be offered for sale.");
    }

    if (!canSellPuppy(currentEpoch, dog.birthEpoch, dog.lifecycleState)) {
      throw new Error("Dogs cannot be offered for sale until 8 weeks of game age.");
    }

    if (dog.marketState !== "NOT_FOR_SALE") {
      throw new Error("This dog is already listed or unavailable for sale.");
    }

    const activeDamBreeding = await tx.breedingAttempt.findFirst({
      where: {
        damId: dog.id,
        status: {
          in: ["INITIATED", "PREGNANT"],
        },
      },
      select: {
        id: true,
      },
    });

    if (activeDamBreeding) {
      throw new Error(
        "Pregnant bitches and bitches awaiting pregnancy checks cannot be listed yet."
      );
    }

    const activeListing = await tx.dogListing.findFirst({
      where: {
        dogId: dog.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    if (activeListing) {
      throw new Error("This dog already has an active listing.");
    }

    const listing = await tx.dogListing.create({
      data: {
        dogId: dog.id,
        sellerKennelId,
        sellerType: "PLAYER",
        askingPrice,
        listingType: PLAYER_SALE_LISTING_TYPE,
        status: "ACTIVE",
        listedAtEpoch: currentEpoch,
        descriptionPublic: `Player listing for ${dog.regNumber}.`,
      },
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

  if (listingDog) {
    await resolveDogDeaths({ currentEpoch, dogIds: [listingDog.dogId] });
  }

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
            ownerKennelId: true,
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

    const [buyer, seller] = await Promise.all([
      tx.kennel.findUnique({
        where: { id: buyerKennelId },
        select: { id: true, balance: true },
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
        marketState: "NOT_FOR_SALE",
      },
    });

    await tx.dogListing.update({
      where: { id: listing.id },
      data: {
        status: "SOLD",
        soldAtEpoch: currentEpoch,
        buyerKennelId: buyer.id,
      },
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

export async function listDogAtStud(args: {
  dogId: string;
  sellerKennelId: string;
  currentEpoch: number;
  studFeeAmount: number;
}): Promise<string> {
  const { dogId, sellerKennelId, currentEpoch, studFeeAmount } = args;

  assertWholeDollarAmount(studFeeAmount, "Stud fee");
  await resolveDogDeaths({ currentEpoch, dogIds: [dogId] });

  return db.$transaction(async (tx) => {
    const dog = await tx.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        regNumber: true,
        ownerKennelId: true,
        sex: true,
        birthEpoch: true,
        lifecycleState: true,
        marketState: true,
      },
    });

    if (!dog) {
      throw new Error("Dog not found.");
    }

    if (dog.ownerKennelId !== sellerKennelId) {
      throw new Error("You do not own this dog.");
    }

    if (dog.lifecycleState !== "ALIVE") {
      throw new Error("Only active dogs can be offered at stud.");
    }

    if (dog.sex !== "M") {
      throw new Error("Only male dogs can be offered at stud.");
    }

    if (currentEpoch - dog.birthEpoch < MIN_BREED_AGE_HOURS) {
      throw new Error("Dogs must be breeding age before they can be offered at stud.");
    }

    if (dog.marketState !== "NOT_FOR_SALE") {
      throw new Error("Dogs listed for sale cannot be offered at stud.");
    }

    const activeListing = await tx.dogListing.findFirst({
      where: {
        dogId: dog.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
      },
    });

    if (activeListing) {
      throw new Error("This dog already has an active listing.");
    }

    const listing = await tx.dogListing.create({
      data: {
        dogId: dog.id,
        sellerKennelId,
        sellerType: "PLAYER",
        askingPrice: studFeeAmount,
        listingType: PLAYER_STUD_LISTING_TYPE,
        status: "ACTIVE",
        listedAtEpoch: currentEpoch,
        descriptionPublic: `Stud listing for ${dog.regNumber}.`,
      },
      select: {
        id: true,
      },
    });

    return listing.id;
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
