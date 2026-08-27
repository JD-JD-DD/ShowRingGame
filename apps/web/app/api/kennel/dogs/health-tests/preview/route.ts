import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  BulkHealthTestPreviewError,
  previewBulkPhenotypeHealthTestsForKennel,
} from "@/server/services/healthTest.service";

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
    const preview = await previewBulkPhenotypeHealthTestsForKennel({
      kennelId: kennel.id,
      dogIds: body.dogIds,
      selection: body.selection,
      currentEpoch: getCurrentEpoch(),
    });

    return ok({ preview });
  } catch (error) {
    if (error instanceof BulkHealthTestPreviewError) {
      return fail(error.message, error.status);
    }

    console.error("POST /api/kennel/dogs/health-tests/preview failed:", error);
    return fail("Unable to preview bulk health tests.", 500);
  }
}
