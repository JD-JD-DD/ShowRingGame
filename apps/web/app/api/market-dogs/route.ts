import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getReleasedBreedCodes } from "@/server/services/breed.service";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  ensureFoundationInventoryForBreed,
  ensureFoundationInventoryForBreeds,
} from "@/server/services/foundationDog.service";
import { listMarketDogs } from "@/server/services/market.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const breedCode2 = searchParams.get("breedCode2")?.trim() || undefined;
    const currentEpoch = getCurrentEpoch();
    const userId = await getSessionUserId();
    const currentKennel = userId ? await getKennelForUser(userId) : null;

    if (breedCode2) {
      await ensureFoundationInventoryForBreed({
        breedCode2,
        currentEpoch,
      });
    } else {
      const releasedBreedCodes = await getReleasedBreedCodes();

      await ensureFoundationInventoryForBreeds({
        breedCode2List: releasedBreedCodes,
        currentEpoch,
      });
    }

    const dogs = await listMarketDogs({
      breedCode2,
      currentEpoch,
      currentKennelId: currentKennel?.id ?? null,
    });

    return ok({ dogs });
  } catch (error) {
    console.error("GET /api/market-dogs failed", error);
    return fail("Unable to load market dogs.", 500);
  }
}
