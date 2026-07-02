import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  KennelRunServiceError,
  createKennelRun,
  listKennelRuns,
} from "@/server/services/kennelRunManagement.service";

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const runs = await listKennelRuns({ kennelId: kennel.id });

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
