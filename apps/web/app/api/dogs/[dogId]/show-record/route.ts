import { fail } from "@/lib/http";
import { createPerfTimer, estimateJsonSizeBytes } from "@/lib/perf";
import { getSessionUserId } from "@/lib/session";
import { getDogShowRecord } from "@/server/services/dog.service";

type RouteProps = {
  params: Promise<{
    dogId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const perf = createPerfTimer({ route: "/api/dogs/[dogId]/show-record" });
  try {
    const userId = await perf.measure("sessionMs", () => getSessionUserId());

    if (!userId) {
      perf.log({ userContextPresent: false, kennelContextPresent: false });
      return fail("Unauthorized.", 401);
    }

    const { dogId } = await perf.measure("paramsMs", () => params);
    const results = await perf.measure("showRecordMs", () =>
      getDogShowRecord({ dogId })
    );

    if (!results) {
      perf.log({
        userContextPresent: true,
        kennelContextPresent: false,
        dogId,
      });
      return fail("Dog not found.", 404);
    }

    perf.log({
      userContextPresent: true,
      kennelContextPresent: false,
      dogId,
      resultCount: results.length,
      payloadSizeBytes: estimateJsonSizeBytes(results),
    });
    return Response.json({
      dogId,
      results,
    });
  } catch (error) {
    console.error("GET /api/dogs/[dogId]/show-record failed", error);
    return fail("Unable to load dog show record.", 500);
  }
}
