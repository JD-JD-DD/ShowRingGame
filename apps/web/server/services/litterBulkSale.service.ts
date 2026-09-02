import { getCurrentEpoch } from "@/lib/gameClock";
import { db } from "@/lib/db";
import {
  bulkListDogsForSale,
  getDogSaleEligibility,
} from "@/server/services/market.service";

type SaleEligibility = {
  dogId: string;
  eligible: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
};

export type LitterBulkSaleResult = {
  listedCount: number;
  skipped: { dogId: string; reason: string }[];
};

export class LitterBulkSaleError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const unavailableForLitterManagement =
  "This puppy is no longer available for litter management.";

async function getLitterSaleEligibility(args: {
  kennelId: string;
  litterId: string;
  dogIds: string[];
}): Promise<SaleEligibility[]> {
  const litter = await db.litter.findUnique({
    where: { id: args.litterId },
    select: { id: true, bredByKennelId: true },
  });
  if (!litter || litter.bredByKennelId !== args.kennelId) {
    throw new LitterBulkSaleError("Litter not found.", 404);
  }

  const dogs = await db.dog.findMany({
    where: { id: { in: args.dogIds } },
    select: { id: true, litterId: true, ownerKennelId: true, lifecycleState: true, visibilityState: true },
  });
  const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
  const currentEpoch = getCurrentEpoch();

  return Promise.all(args.dogIds.map(async (dogId) => {
    const dog = dogsById.get(dogId);
    if (
      !dog ||
      dog.litterId !== litter.id ||
      dog.ownerKennelId !== args.kennelId ||
      dog.lifecycleState !== "ALIVE" ||
      dog.visibilityState === "HIDDEN_NEONATAL_LOSS"
    ) {
      return { dogId, eligible: false, reasonCode: "UNAVAILABLE", reasonMessage: unavailableForLitterManagement };
    }
    return getDogSaleEligibility({ dogId, sellerKennelId: args.kennelId, currentEpoch });
  }));
}

export async function preflightLitterPuppySale(args: {
  kennelId: string;
  litterId: string;
  dogIds: string[];
}): Promise<{ dogs: SaleEligibility[] }> {
  return { dogs: await getLitterSaleEligibility(args) };
}

export async function bulkListLitterPuppiesForSale(args: {
  kennelId: string;
  litterId: string;
  updates: Array<{ dogId: string; askingPrice: number }>;
}): Promise<LitterBulkSaleResult> {
  const eligibility = await getLitterSaleEligibility({
    kennelId: args.kennelId,
    litterId: args.litterId,
    dogIds: args.updates.map((update) => update.dogId),
  });
  const eligibilityByDogId = new Map(eligibility.map((result) => [result.dogId, result]));
  const affectedUpdates = args.updates.filter((update) => eligibilityByDogId.get(update.dogId)?.eligible);
  const skipped = eligibility
    .filter((result) => !result.eligible)
    .map((result) => ({ dogId: result.dogId, reason: result.reasonMessage ?? unavailableForLitterManagement }));

  if (affectedUpdates.length === 0) return { listedCount: 0, skipped };

  const result = await bulkListDogsForSale({
    sellerKennelId: args.kennelId,
    currentEpoch: getCurrentEpoch(),
    updates: affectedUpdates,
  });
  return { ...result, skipped };
}
