import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  createBreedingAttemptForKennel,
  listBreedingsForKennel,
} from "@/server/services/breeding.service";

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const currentEpoch = getCurrentEpoch();
    const { searchParams } = new URL(request.url);
    const dogId = searchParams.get("dogId")?.trim() || undefined;

    const breedings = await listBreedingsForKennel({
      kennelId: kennel.id,
      currentEpoch,
      dogId,
    });

    return ok({
      currentEpoch,
      breedings,
    });
  } catch (error) {
    console.error("GET /api/breedings failed", error);
    return fail("Unable to load breeding attempts.", 500);
  }
}

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

    const body = await request.json();

    const primaryDogId =
      typeof body.primaryDogId === "string" ? body.primaryDogId.trim() : "";
    const mateDogId =
      typeof body.mateDogId === "string" ? body.mateDogId.trim() : "";
    const studListingId =
      typeof body.studListingId === "string" ? body.studListingId.trim() : "";
    const testDamBrucellosis = body.testDamBrucellosis === true;
    const testSireBrucellosis = body.testSireBrucellosis === true;

    if (!primaryDogId || !mateDogId) {
      return fail("primaryDogId and mateDogId are required.", 400);
    }

    const currentEpoch = getCurrentEpoch();

    const attempt = await createBreedingAttemptForKennel({
      kennelId: kennel.id,
      primaryDogId,
      mateDogId,
      studListingId: studListingId || undefined,
      currentEpoch,
      testDamBrucellosis,
      testSireBrucellosis,
    });

    return ok({
      attempt,
      message: "Breeding attempt created.",
    });
  } catch (error) {
    console.error("POST /api/breedings failed", error);
    return fail(
      error instanceof Error ? error.message : "Unable to create breeding attempt.",
      400
    );
  }
}

