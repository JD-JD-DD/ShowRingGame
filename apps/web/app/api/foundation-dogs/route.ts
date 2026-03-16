import { ok, fail } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getReleasedBreedCodes } from "@/server/services/breed.service";
import {
  ensureFoundationInventoryForBreed,
  ensureFoundationInventoryForBreeds,
  listFoundationDogs,
} from "@/server/services/foundationDog.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const breedCode2 = searchParams.get("breedCode2")?.trim() || undefined;

    const currentEpoch = getCurrentEpoch();

    if (breedCode2) {
      await ensureFoundationInventoryForBreed({
        breedCode2,
        currentEpoch,
      });

      const dogs = await listFoundationDogs({
        breedCode2,
        currentEpoch,
      });

      return ok({ dogs });
    }

    const releasedBreedCodes = await getReleasedBreedCodes();

    await ensureFoundationInventoryForBreeds({
      breedCode2List: releasedBreedCodes,
      currentEpoch,
    });

    const dogs = await listFoundationDogs({
      currentEpoch,
    });

    return ok({ dogs });
  } catch (error) {
    console.error("GET /api/foundation-dogs failed", error);
    return fail("Unable to load foundation dogs.", 500);
  }
}
