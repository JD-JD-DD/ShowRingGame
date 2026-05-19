import { getCurrentEpoch } from "@/lib/gameClock";
import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { getLitterForKennel } from "@/server/services/litter.service";

type RouteProps = {
  params: Promise<{
    litterId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const { litterId } = await params;
    const currentEpoch = getCurrentEpoch();
    const litter = await getLitterForKennel({
      kennelId: kennel.id,
      litterId,
      currentEpoch,
    });

    if (!litter) {
      return fail("Litter not found.", 404);
    }

    return ok({
      currentEpoch,
      litter,
    });
  } catch (error) {
    console.error("GET /api/litters/[litterId] failed", error);
    return fail("Unable to load litter.", 500);
  }
}
