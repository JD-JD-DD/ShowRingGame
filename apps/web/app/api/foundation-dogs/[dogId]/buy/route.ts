import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { buyFoundationDog } from "@/server/services/foundationDog.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  try {
    const { dogId } = await params;

    const userId = await getSessionUserId();
    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);
    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const currentEpoch = getCurrentEpoch();
    const dog = await buyFoundationDog({
      dogId,
      kennelId: kennel.id,
      currentEpoch,
    });

    return ok({ dog });
  } catch (error) {
    console.error("POST /api/foundation-dogs/[dogId]/buy failed", error);
    return fail(
      error instanceof Error ? error.message : "Unable to buy foundation dog.",
      400
    );
  }
}
