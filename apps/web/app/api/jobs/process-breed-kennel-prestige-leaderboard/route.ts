import { fail, ok } from "@/lib/http";
import { isAuthorizedJobRequest } from "@/lib/jobAuthorization";
import {
  orchestrateBreedKennelPrestigeLeaderboard,
  type BreedKennelPrestigeLeaderboardOperation,
} from "@/server/services/breedKennelPrestigeLeaderboardOrchestration.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Orchestrate = (operation: BreedKennelPrestigeLeaderboardOperation) => ReturnType<typeof orchestrateBreedKennelPrestigeLeaderboard>;

function isOperation(value: unknown): value is BreedKennelPrestigeLeaderboardOperation {
  return value === "process" || value === "publish";
}

async function parseOperation(request: Request): Promise<BreedKennelPrestigeLeaderboardOperation | null> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1) return null;
    const action = (body as { action?: unknown }).action;
    return isOperation(action) ? action : null;
  } catch {
    return null;
  }
}

export function createProcessBreedKennelPrestigeLeaderboardHandler(
  args: { orchestrate?: Orchestrate } = {}
) {
  const orchestrate = args.orchestrate ?? orchestrateBreedKennelPrestigeLeaderboard;

  return async function POST(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    const manualSecret = process.env.SHOWRING_JOBS_SECRET;
    if (!cronSecret && !manualSecret && process.env.NODE_ENV === "production") {
      return fail("A job authorization secret is required in production.", 500);
    }
    if (!isAuthorizedJobRequest({ authorization: request.headers.get("authorization"), cronSecret, manualSecret })) {
      return fail("Unauthorized.", 401);
    }
    const operation = await parseOperation(request);
    if (!operation) return fail("Request action must be either process or publish.", 400);

    const result = await orchestrate(operation);
    const failed = result.outcome === "calculation_failed" || result.outcome === "publication_failed";
    return ok({ result }, { status: failed ? 500 : 200 });
  };
}

export const POST = createProcessBreedKennelPrestigeLeaderboardHandler();
