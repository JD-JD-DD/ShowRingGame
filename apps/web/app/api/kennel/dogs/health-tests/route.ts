import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  BulkHealthTestPreviewError,
  runBulkPhenotypeHealthTestsForKennel,
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
    const result = await runBulkPhenotypeHealthTestsForKennel({
      kennelId: kennel.id,
      dogIds: body.dogIds,
      selection: body.selection,
      currentEpoch: getCurrentEpoch(),
    });

    return ok({ result });
  } catch (error) {
    if (error instanceof BulkHealthTestPreviewError) {
      return fail(error.message, error.status);
    }

    console.error("POST /api/kennel/dogs/health-tests failed:", error);
    const safeMessage =
      error instanceof Error && error.message.startsWith("Insufficient funds")
        ? error.message
        : "Unable to run bulk health tests.";
    return fail(safeMessage, safeMessage.startsWith("Insufficient funds") ? 400 : 500);
  }
}
