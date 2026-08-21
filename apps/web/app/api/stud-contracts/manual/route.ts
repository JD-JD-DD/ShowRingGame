import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { createManualStudContractRequest } from "@/server/services/studContractRequest.service";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);
    const kennel = await getKennelForUser(userId);
    if (!kennel) return fail("Kennel not found.", 404);
    const body = await request.json();
    const studListingId = typeof body.studListingId === "string" ? body.studListingId.trim() : "";
    const sireDogId = typeof body.sireDogId === "string" ? body.sireDogId.trim() : "";
    const damDogId = typeof body.damDogId === "string" ? body.damDogId.trim() : "";
    if (!studListingId || !sireDogId || !damDogId) return fail("Stud listing, sire, and dam are required.", 400);
    const contract = await createManualStudContractRequest({
      kennelId: kennel.id, studListingId, sireDogId, damDogId, currentEpoch: getCurrentEpoch(),
    });
    return ok({ contract, message: "Stud approval pending. No breeding or payment has occurred." });
  } catch (error) {
    console.error("POST /api/stud-contracts/manual failed", error);
    return fail(error instanceof Error ? error.message : "Unable to request Stud Approval.", 400);
  }
}
