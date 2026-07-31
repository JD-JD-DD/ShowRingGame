import { getCurrentEpoch } from "@/lib/gameClock";
import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { authorizeReproductiveEmergencyTreatment } from "@/server/services/reproductiveEmergencyTreatment.service";

export async function POST(_: Request, context: { params: Promise<{ eventId: string }> }) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);
    const kennel = await getKennelForUser(userId);
    if (!kennel) return fail("Kennel not found.", 404);
    const { eventId } = await context.params;
    if (!eventId?.trim()) return fail("Reproductive emergency event ID is required.", 400);
    const result = await authorizeReproductiveEmergencyTreatment({
      eventId, kennelId: kennel.id, currentEpoch: getCurrentEpoch(),
    });
    return ok({ result, message: "Emergency treatment has been authorized. Outcome resolution is pending." });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to authorize emergency treatment.", 400);
  }
}
