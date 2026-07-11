import { fail, ok } from "@/lib/http";
import { createPerfTimer, estimateJsonSizeBytes } from "@/lib/perf";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  KennelRunServiceError,
  createKennelRun,
  listKennelRuns,
} from "@/server/services/kennelRunManagement.service";

export async function GET() {
  const perf = createPerfTimer({ route: "/api/kennel/runs" });
  try {
    const userId = await perf.measure("sessionMs", () => getSessionUserId());

    if (!userId) {
      perf.log({ userContextPresent: false, kennelContextPresent: false });
      return fail("Unauthorized.", 401);
    }

    const kennel = await perf.measure("kennelLookupMs", () =>
      getKennelForUser(userId)
    );

    if (!kennel) {
      perf.log({ userContextPresent: true, kennelContextPresent: false });
      return fail("Kennel not found.", 404);
    }

    const runs = await perf.measure("listRunsMs", () =>
      listKennelRuns({ kennelId: kennel.id })
    );

    perf.log({
      userContextPresent: true,
      kennelContextPresent: true,
      runCount: runs.length,
      payloadSizeBytes: estimateJsonSizeBytes(runs),
    });
    return ok({ runs });
  } catch (error) {
    console.error("GET /api/kennel/runs failed:", error);
    return fail("Unable to load Kennel Runs.", 500);
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

    const body = await request.json().catch(() => ({}));
    const run = await createKennelRun({
      kennelId: kennel.id,
      name: body.name,
    });

    return ok({ run });
  } catch (error) {
    if (error instanceof KennelRunServiceError) {
      return fail(error.message, error.status);
    }

    console.error("POST /api/kennel/runs failed:", error);
    return fail("Unable to create Kennel Run.", 500);
  }
}
