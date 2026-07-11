import { getCurrentEpoch } from "@/lib/gameClock";
import { fail } from "@/lib/http";
import { createPerfTimer, estimateJsonSizeBytes } from "@/lib/perf";
import { getSessionUserId } from "@/lib/session";
import { getDogProfile } from "@/server/services/dog.service";
import { getKennelForUser } from "@/server/services/kennel.service";

type RouteProps = {
  params: Promise<{
    dogId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const perf = createPerfTimer({ route: "/api/dogs/[dogId]" });
  try {
    const userId = await perf.measure("sessionMs", () => getSessionUserId());

    if (!userId) {
      perf.log({ userContextPresent: false, kennelContextPresent: false });
      return fail("Unauthorized.", 401);
    }

    const [{ dogId }, kennel] = await perf.measure("paramsAndKennelMs", () =>
      Promise.all([params, getKennelForUser(userId)])
    );
    const profile = await perf.measure("dogProfileMs", () =>
      getDogProfile({
        dogId,
        viewerKennelId: kennel?.id ?? null,
        currentEpoch: getCurrentEpoch(),
      })
    );

    if (!profile) {
      perf.log({
        userContextPresent: true,
        kennelContextPresent: Boolean(kennel),
        dogId,
      });
      return fail("Dog not found.", 404);
    }

    perf.log({
      userContextPresent: true,
      kennelContextPresent: Boolean(kennel),
      dogId,
      recentResultCount: profile.titlesAndShowCareer.recentShowResults.length,
      payloadSizeBytes: estimateJsonSizeBytes(profile),
    });
    return Response.json(profile);
  } catch (error) {
    console.error("GET /api/dogs/[dogId] failed", error);
    return fail("Unable to load dog profile.", 500);
  }
}
