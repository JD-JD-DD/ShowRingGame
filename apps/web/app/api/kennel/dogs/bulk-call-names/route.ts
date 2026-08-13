import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  KennelRunServiceError,
  updateKennelRunDogCallNames,
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
    const result = await updateKennelRunDogCallNames({
      kennelId: kennel.id,
      kennelRunId: body.kennelRunId,
      updates: body.updates,
    });

    return ok(result);
  } catch (error) {
    if (error instanceof KennelRunServiceError) {
      return fail(error.message, error.status);
    }

    console.error("PATCH /api/kennel/dogs/bulk-call-names failed:", error);
    return fail("Unable to update call names.", 500);
  }
}
