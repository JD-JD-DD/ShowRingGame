import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { resolveDueBreedingProgressForKennel } from "@/server/services/breeding.service";
import { resolveDogDeaths } from "@/server/services/lifecycle.service";
import { getProgramPlannerData } from "@/server/services/programPlanner.service";

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
    await resolveDogDeaths({ kennelId: kennel.id, currentEpoch });
    await resolveDueBreedingProgressForKennel({
      kennelId: kennel.id,
      currentEpoch,
    });

    const { searchParams } = new URL(request.url);
    const breedCode2 = searchParams.get("breedCode2")?.trim() || null;
    const goalKey = searchParams.get("goalKey")?.trim() || null;

    const planner = await getProgramPlannerData({
      kennelId: kennel.id,
      currentEpoch,
      breedCode2,
      goalKey,
    });

    return ok({
      kennel: {
        id: kennel.id,
        name: kennel.name,
        balance: kennel.balance,
      },
      currentEpoch,
      planner,
    });
  } catch (error) {
    console.error("GET /api/kennel/program-planner failed", error);
    return fail("Unable to load Program Planner.", 500);
  }
}
