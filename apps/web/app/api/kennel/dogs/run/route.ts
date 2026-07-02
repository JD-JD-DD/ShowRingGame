import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  KennelRunServiceError,
  moveDogsToKennelRun,
} from "@/server/services/kennelRunManagement.service";

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const body = await request.json().catch(() => ({}));
    const result = await moveDogsToKennelRun({
      kennelId: kennel.id,
      dogIds: body.dogIds,
      targetRunId: body.targetRunId,
    });

    return ok(result);
  } catch (error) {
    if (error instanceof KennelRunServiceError) {
      return fail(error.message, error.status);
    }

    console.error("PATCH /api/kennel/dogs/run failed:", error);
    return fail("Unable to move dogs to Kennel Run.", 500);
  }
}
