import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { KennelRunServiceError } from "@/server/services/kennelRunManagement.service";
import {
  LitterBulkKennelRunError,
  moveLitterPuppiesToKennelRun,
} from "@/server/services/litterBulkKennelRun.service";

function parseMoveRequest(body: unknown): { dogIds: string[]; targetRunId: string } | null {
  if (!body || typeof body !== "object") return null;
  const { dogIds, targetRunId } = body as { dogIds?: unknown; targetRunId?: unknown };
  if (!Array.isArray(dogIds) || dogIds.length === 0 || typeof targetRunId !== "string" || !targetRunId.trim()) return null;

  const seenDogIds = new Set<string>();
  for (const dogId of dogIds) {
    if (typeof dogId !== "string" || !dogId || seenDogIds.has(dogId)) return null;
    seenDogIds.add(dogId);
  }
  return { dogIds, targetRunId: targetRunId.trim() };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ litterId: string }> }) {
  try {
    const [{ litterId }, userId] = await Promise.all([params, getSessionUserId()]);
    if (!userId) return fail("Unauthorized.", 401);

    const kennel = await db.kennel.findUnique({ where: { userId }, select: { id: true } });
    if (!kennel) return fail("Kennel not found.", 404);

    const moveRequest = parseMoveRequest(await request.json().catch(() => null));
    if (!moveRequest) return fail("Invalid Kennel Run move request.", 400);

    return ok(await moveLitterPuppiesToKennelRun({ kennelId: kennel.id, litterId, ...moveRequest }));
  } catch (error) {
    if (error instanceof LitterBulkKennelRunError || error instanceof KennelRunServiceError) {
      return fail(error.message, error.status);
    }
    console.error("PATCH /api/litters/[litterId]/puppies/bulk-kennel-run failed:", error);
    return fail("Unable to move puppies to Kennel Run.", 500);
  }
}
