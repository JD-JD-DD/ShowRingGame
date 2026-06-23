import { getCurrentEpoch } from "@/lib/gameClock";
import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { authorizeEmergencyTreatment } from "@/server/services/emergencyVetCare.service";
import { getKennelForUser } from "@/server/services/kennel.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const { dogId } = await params;

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const result = await authorizeEmergencyTreatment({
      kennelId: kennel.id,
      dogId,
      currentEpoch: getCurrentEpoch(),
    });

    return ok({
      emergencyCareEvent: result.event,
      dogDied: result.dogDied,
    });
  } catch (error) {
    console.error(
      "POST /api/dogs/[dogId]/emergency-care/treat failed:",
      error
    );

    return fail(
      error instanceof Error
        ? error.message
        : "Unable to authorize emergency vet care."
    );
  }
}
