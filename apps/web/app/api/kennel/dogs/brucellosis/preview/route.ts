import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  BulkBrucellosisPreviewError,
  previewBulkBrucellosisScreeningForKennel,
} from "@/server/services/infectiousDisease.service";

export async function POST(request: Request) {
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
    const preview = await previewBulkBrucellosisScreeningForKennel({
      kennelId: kennel.id,
      dogIds: body.dogIds,
    });

    return ok({ preview });
  } catch (error) {
    if (error instanceof BulkBrucellosisPreviewError) {
      return fail(error.message, error.status);
    }

    console.error("POST /api/kennel/dogs/brucellosis/preview failed:", error);
    return fail("Unable to calculate the brucellosis screening estimate.", 500);
  }
}
