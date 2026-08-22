import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { attemptStudContractReturnService } from "@/server/services/breeding.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ returnServiceId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);
    const kennel = await getKennelForUser(userId);
    if (!kennel) return fail("Kennel not found.", 404);
    const { returnServiceId } = await params;
    if (!returnServiceId.trim()) return fail("Return Service not found.", 404);
    const attempt = await attemptStudContractReturnService({
      kennelId: kennel.id,
      returnServiceId: returnServiceId.trim(),
      currentEpoch: getCurrentEpoch(),
    });
    return ok({ attempt, message: "Return Service used and breeding attempt created." });
  } catch (error) {
    console.error("POST /api/stud-contract-return-services/[returnServiceId]/attempt failed", error);
    return fail(error instanceof Error ? error.message : "Unable to use Return Service.", 400);
  }
}
