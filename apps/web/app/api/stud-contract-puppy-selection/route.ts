import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { selectDamProtectedPuppy, selectStudContractPuppy } from "@/server/services/studContractPuppySelection.service";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);
    const kennel = await getKennelForUser(userId);
    if (!kennel) return fail("Your kennel could not be found.", 404);
    const body = await request.json();
    if (!body || typeof body.selectionId !== "string" || typeof body.puppyId !== "string" || (body.action !== "DAM_PROTECTED_PICK" && body.action !== "STUD_PICK")) return fail("Invalid puppy selection.", 400);
    const args = { kennelId: kennel.id, selectionId: body.selectionId, puppyId: body.puppyId, currentEpoch: getCurrentEpoch() };
    const result = body.action === "DAM_PROTECTED_PICK" ? await selectDamProtectedPuppy(args) : await selectStudContractPuppy(args);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Puppy selection could not be recorded.";
    return fail(message, 400);
  }
}
