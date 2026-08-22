import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { approveManualStudContractForKennel } from "@/server/services/breeding.service";

export async function POST(_: Request, { params }: { params: Promise<{ contractId: string }> }) {
  try {
    const userId = await getSessionUserId(); if (!userId) return fail("Unauthorized.", 401);
    const kennel = await getKennelForUser(userId); if (!kennel) return fail("Kennel not found.", 404);
    const { contractId } = await params;
    const attempt = await approveManualStudContractForKennel({
      contractId,
      sireKennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
    });
    return ok({ attempt, message: "Stud approval accepted and breeding initiated." });
  } catch (error) { return fail(error instanceof Error ? error.message : "Unable to approve Stud approval.", 400); }
}
