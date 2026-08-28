import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  BulkDogSaleError,
  assertWholeDollarAmount,
  bulkListDogsForSale,
} from "@/server/services/market.service";

const MAX_BULK_SALE_UPDATES = 200;

type BulkSaleUpdate = { dogId: string; askingPrice: number };

function parseWholeDollarPrice(value: unknown): number | null {
  const price =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number.parseInt(value.trim(), 10)
        : null;
  if (price === null) return null;
  try {
    assertWholeDollarAmount(price, "Sale price");
    return price;
  } catch {
    return null;
  }
}

function parseUpdates(value: unknown): BulkSaleUpdate[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BULK_SALE_UPDATES) {
    return null;
  }
  const updates: BulkSaleUpdate[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return null;
    const { dogId, askingPrice } = candidate as Record<string, unknown>;
    const price = parseWholeDollarPrice(askingPrice);
    if (typeof dogId !== "string" || !dogId.trim() || price === null) return null;
    updates.push({ dogId: dogId.trim(), askingPrice: price });
  }
  return new Set(updates.map((update) => update.dogId)).size === updates.length
    ? updates
    : null;
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);

    const kennel = await getKennelForUser(userId);
    if (!kennel) return fail("Kennel not found.", 404);

    const body = await request.json().catch(() => null);
    const updates = parseUpdates(body?.updates);
    if (!updates) {
      return fail("Provide between 1 and 200 unique dogs with whole-dollar sale prices of at least $1.", 400);
    }

    const result = await bulkListDogsForSale({
      sellerKennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
      updates,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof BulkDogSaleError) {
      return fail(error.message, 400, error.details);
    }
    console.error("POST /api/kennel/dogs/bulk-for-sale failed:", error);
    return fail("Unable to list dogs for sale.", 500);
  }
}
