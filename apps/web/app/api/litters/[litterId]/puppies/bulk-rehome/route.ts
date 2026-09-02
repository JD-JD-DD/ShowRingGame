import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { RehomeError } from "@/server/services/rehome.service";
import { LitterBulkRehomeError, rehomeLitterPuppies } from "@/server/services/litterBulkRehome.service";

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
    if (!dogIds) return fail("Select unique puppies to re-home.", 400);
    return ok(await rehomeLitterPuppies({ kennelId: kennel.id, litterId, dogIds }));
  } catch (error) {
    if (error instanceof LitterBulkRehomeError || error instanceof RehomeError) return fail(error.message, error.status);
    console.error("POST /api/litters/[litterId]/puppies/bulk-rehome failed:", error);
    return fail("We could not re-home these puppies. Please try again.", 500);
  }
}
