import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import {
  RehomeError,
  rehomeOwnedDogs,
} from "@/server/services/rehome.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ litterId: string; dogId: string }> }
) {
  try {
    const [{ litterId, dogId }, userId] = await Promise.all([
      params,
      getSessionUserId(),
    ]);
    if (!userId) return fail("Unauthorized.", 401);

    const kennel = await db.kennel.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!kennel) return fail("Kennel not found.", 404);

    const litter = await db.litter.findUnique({
      where: { id: litterId },
      select: { id: true, bredByKennelId: true },
    });
    if (!litter || litter.bredByKennelId !== kennel.id) {
      return fail("Litter not found.", 404);
    }

    const puppy = await db.dog.findUnique({
      where: { id: dogId },
      select: { id: true, litterId: true, ownerKennelId: true },
    });
    if (!puppy || puppy.litterId !== litter.id) {
      return fail("Puppy not found in this litter.", 404);
    }
    if (puppy.ownerKennelId !== kennel.id) {
      return fail("This puppy is no longer owned by your kennel.", 403);
    }

    const result = await rehomeOwnedDogs({
      kennelId: kennel.id,
      dogIds: [dogId],
      currentEpoch: getCurrentEpoch(),
    });
    return ok(result);
  } catch (error) {
    if (error instanceof RehomeError) {
      return fail(error.message, error.status);
    }

    console.error("POST /api/litters/[litterId]/puppies/[dogId]/rehome failed:", error);
    return fail("We could not re-home this puppy. Please try again.", 500);
  }
}
