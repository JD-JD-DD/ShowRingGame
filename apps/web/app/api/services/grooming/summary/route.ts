import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getKennelGroomingSummary } from "@/server/services/grooming.service";

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

    return ok({
      currentEpoch,
      summary: await getKennelGroomingSummary({
        kennelId: kennel.id,
        currentEpoch,
      }),
    });
  } catch (error) {
    console.error("GET /api/services/grooming/summary failed:", error);
    return fail("Unable to load grooming summary.", 500);
  }
}
