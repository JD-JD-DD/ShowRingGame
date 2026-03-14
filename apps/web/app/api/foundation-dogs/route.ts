import { ok, fail } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { listFoundationDogs } from "@/server/services/foundationDog.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const breedCode2 = searchParams.get("breedCode2") ?? undefined;

    const currentEpoch = getCurrentEpoch();

    const dogs = await listFoundationDogs({
      breedCode2,
      currentEpoch,
    });

    return ok({ dogs });
  } catch (error) {
    console.error("GET /api/foundation-dogs failed", error);
    return fail("Unable to load foundation dogs.", 500);
  }
}
