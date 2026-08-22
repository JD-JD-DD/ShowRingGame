import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  createAutomaticStudContractBreedingForKennel,
} from "@/server/services/breeding.service";
import { getKennelForUser } from "@/server/services/kennel.service";
import { PLAYER_OBLIGATIONS_ERROR } from "@/lib/studContractDisclosures";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);
    const kennel = await getKennelForUser(userId);
    if (!kennel) return fail("Kennel not found.", 404);
    const body = await request.json();
    const suppliedStudListingId = typeof body.studListingId === "string" ? body.studListingId.trim() : "";
    const studListingId = suppliedStudListingId || undefined;
    const sireDogId = typeof body.sireDogId === "string" ? body.sireDogId.trim() : "";
    const damDogId = typeof body.damDogId === "string" ? body.damDogId.trim() : "";
    const source = body.source === "STUD_OFFER" || body.source === "LEGACY_PLAYER_STUD" ? body.source : null;
    if (body.playerObligationsAcknowledged !== true) return fail(PLAYER_OBLIGATIONS_ERROR, 400);
    if (
      !source ||
      !sireDogId ||
      !damDogId ||
      (source === "LEGACY_PLAYER_STUD" && !studListingId) ||
      (source === "STUD_OFFER" && suppliedStudListingId)
    ) {
      return fail("Stud source, sire, and dam are required.", 400);
    }
    const attempt = await createAutomaticStudContractBreedingForKennel({
      kennelId: kennel.id,
      studListingId,
      sireDogId,
      damDogId,
      source,
      currentEpoch: getCurrentEpoch(),
    });
    return ok({ attempt, message: "Terms accepted and breeding initiated." });
  } catch (error) {
    console.error("POST /api/stud-contracts/automatic failed", error);
    return fail(
      error instanceof Error ? error.message : "Unable to accept Stud Contract terms.",
      400
    );
  }
}
