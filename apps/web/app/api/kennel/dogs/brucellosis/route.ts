import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  BulkBrucellosisExecutionError,
  BulkBrucellosisPreviewError,
  runBulkBrucellosisScreeningForKennel,
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
    const result = await runBulkBrucellosisScreeningForKennel({
      kennelId: kennel.id,
      dogIds: body.dogIds,
      currentEpoch: getCurrentEpoch(),
    });

    return ok({ result });
  } catch (error) {
    if (
      error instanceof BulkBrucellosisPreviewError ||
      error instanceof BulkBrucellosisExecutionError
    ) {
      return fail(error.message, error.status);
    }

    console.error("POST /api/kennel/dogs/brucellosis failed:", error);
    return fail("Unable to complete brucellosis screenings.", 500);
  }
}
