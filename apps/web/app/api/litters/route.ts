import { getCurrentEpoch } from "@/lib/gameClock";
import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listLittersForKennel } from "@/server/services/litter.service";

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const currentEpoch = getCurrentEpoch();
    const { litters, activeBreedings } = await listLittersForKennel({
      kennelId: kennel.id,
      currentEpoch,
    });

    return ok({
      currentEpoch,
      litters,
      activeBreedings,
    });
  } catch (error) {
    console.error("GET /api/litters failed", error);
    return fail("Unable to load litters.", 500);
  }
}
