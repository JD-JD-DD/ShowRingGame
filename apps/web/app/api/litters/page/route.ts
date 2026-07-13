import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  listLitterPageForKennel,
  type LitterListCursor,
} from "@/server/services/litter.service";

function parseCursor(input: unknown): LitterListCursor | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;

  return typeof candidate.bornEpoch === "number" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.litterId === "string"
    ? {
        bornEpoch: candidate.bornEpoch,
        createdAt: candidate.createdAt,
        litterId: candidate.litterId,
      }
    : null;
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Please sign in to load more litters.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Your kennel could not be found.", 404);
    }

    const body = await request.json();
    const cursor = parseCursor(body.cursor);
    const currentEpoch = getCurrentEpoch();
    const page = await listLitterPageForKennel({
      kennelId: kennel.id,
      currentEpoch,
      cursor,
      limit: 10,
    });

    return ok(page);
  } catch (error) {
    console.error("POST /api/litters/page failed", error);
    return fail("We couldn't load more litters right now. Please try again.", 500);
  }
}
