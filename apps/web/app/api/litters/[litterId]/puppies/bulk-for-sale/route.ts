import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  BulkDogSaleError,
  assertWholeDollarAmount,
  parseWholeDollarPrice,
} from "@/server/services/market.service";
import { LitterBulkSaleError, bulkListLitterPuppiesForSale } from "@/server/services/litterBulkSale.service";

function parseUpdates(value: unknown): Array<{ dogId: string; askingPrice: number }> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const updates = value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") return null;
    const { dogId, askingPrice } = candidate as Record<string, unknown>;
    const price = parseWholeDollarPrice(askingPrice);
    if (typeof dogId !== "string" || !dogId.trim() || price === null) return null;
    try { assertWholeDollarAmount(price, "Sale price"); } catch { return null; }
    return { dogId: dogId.trim(), askingPrice: price };
  });
  if (updates.some((update) => !update)) return null;
  const parsed = updates as Array<{ dogId: string; askingPrice: number }>;
  return new Set(parsed.map((update) => update.dogId)).size === parsed.length ? parsed : null;
}

export async function POST(request: Request, { params }: { params: Promise<{ litterId: string }> }) {
  try {
    const [{ litterId }, userId] = await Promise.all([params, getSessionUserId()]);
    if (!userId) return fail("Unauthorized.", 401);
    const kennel = await db.kennel.findUnique({ where: { userId }, select: { id: true } });
    if (!kennel) return fail("Kennel not found.", 404);
    const updates = parseUpdates((await request.json().catch(() => null))?.updates);
    if (!updates) return fail("Provide unique puppies with whole-dollar sale prices of at least $1.", 400);
    return ok(await bulkListLitterPuppiesForSale({ kennelId: kennel.id, litterId, updates }));
  } catch (error) {
    if (error instanceof LitterBulkSaleError) return fail(error.message, error.status);
    if (error instanceof BulkDogSaleError) return fail(error.message, 400, error.details);
    console.error("POST /api/litters/[litterId]/puppies/bulk-for-sale failed:", error);
    return fail("Unable to list puppies for sale.", 500);
  }
}
