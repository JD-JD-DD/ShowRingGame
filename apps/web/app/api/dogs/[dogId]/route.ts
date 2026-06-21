import { getCurrentEpoch } from "@/lib/gameClock";
import { fail } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getDogProfile } from "@/server/services/dog.service";
import { getKennelForUser } from "@/server/services/kennel.service";

type RouteProps = {
  params: Promise<{
    dogId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const [{ dogId }, kennel] = await Promise.all([
      params,
      getKennelForUser(userId),
    ]);
    const profile = await getDogProfile({
      dogId,
      viewerKennelId: kennel?.id ?? null,
      currentEpoch: getCurrentEpoch(),
    });

    if (!profile) {
      return fail("Dog not found.", 404);
    }

    return Response.json(profile);
  } catch (error) {
    console.error("GET /api/dogs/[dogId] failed", error);
    return fail("Unable to load dog profile.", 500);
  }
}
