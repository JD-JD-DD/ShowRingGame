import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { LitterBulkSaleError, preflightLitterPuppySale } from "@/server/services/litterBulkSale.service";

function parseDogIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every((dogId) => typeof dogId === "string" && dogId.trim())) return null;
  const dogIds = value.map((dogId) => dogId.trim());
  return new Set(dogIds).size === dogIds.length ? dogIds : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ litterId: string }> }) {
  try {
    const [{ litterId }, userId] = await Promise.all([params, getSessionUserId()]);
    if (!userId) return fail("Unauthorized.", 401);
    const kennel = await db.kennel.findUnique({ where: { userId }, select: { id: true } });
    if (!kennel) return fail("Kennel not found.", 404);
    const dogIds = parseDogIds((await request.json().catch(() => null))?.dogIds);
    if (!dogIds) return fail("Select at least one puppy to check for sale.", 400);
    return ok(await preflightLitterPuppySale({ kennelId: kennel.id, litterId, dogIds }));
  } catch (error) {
    if (error instanceof LitterBulkSaleError) return fail(error.message, error.status);
    console.error("POST /api/litters/[litterId]/puppies/bulk-sale-preflight failed:", error);
    return fail("Unable to check puppy sale eligibility.", 500);
  }
}
