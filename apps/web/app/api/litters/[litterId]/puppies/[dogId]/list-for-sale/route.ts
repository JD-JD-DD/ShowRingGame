import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  listDogForSale,
  parseWholeDollarPrice,
} from "@/server/services/market.service";

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

    const kennel = await getKennelForUser(userId);
    if (!kennel) return fail("Kennel not found.", 404);

    const body: Record<string, unknown> = await request.json().catch(() => ({}));
    const askingPrice = parseWholeDollarPrice(body.askingPrice);
    if (askingPrice === null || askingPrice < 1) {
      return fail("Sale price must be a whole dollar amount of at least $1.");
    }

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

    const listingId = await listDogForSale({
      dogId,
      sellerKennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
      askingPrice,
    });

    return ok({ listingId });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to list puppy for sale.",
      400
    );
  }
}
