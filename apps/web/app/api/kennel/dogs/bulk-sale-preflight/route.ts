import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getDogSaleEligibility } from "@/server/services/market.service";

const MAX_BULK_SALE_PREFLIGHT_DOGS = 200;

function parseDogIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BULK_SALE_PREFLIGHT_DOGS) {
    return null;
  }
  if (!value.every((dogId) => typeof dogId === "string" && dogId.trim().length > 0)) {
    return null;
  }
  const dogIds = value.map((dogId) => dogId.trim());
  return new Set(dogIds).size === dogIds.length ? dogIds : null;
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);

    const kennel = await getKennelForUser(userId);
    if (!kennel) return fail("Kennel not found.", 404);

    const body = await request.json().catch(() => null);
    const dogIds = parseDogIds(body?.dogIds);
    if (!dogIds) return fail("Select between 1 and 200 dogs to check for sale.", 400);

    const currentEpoch = getCurrentEpoch();
    const dogs = await Promise.all(
      dogIds.map((dogId) =>
        getDogSaleEligibility({
          dogId,
          sellerKennelId: kennel.id,
          currentEpoch,
        })
      )
    );

    return ok({ dogs });
  } catch (error) {
    console.error("POST /api/kennel/dogs/bulk-sale-preflight failed:", error);
    return fail("Unable to check sale eligibility.", 500);
  }
}
