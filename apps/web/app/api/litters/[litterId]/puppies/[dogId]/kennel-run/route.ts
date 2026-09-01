import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  KennelRunServiceError,
  moveDogsToKennelRun,
} from "@/server/services/kennelRunManagement.service";

export async function PATCH(
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

    const body: Record<string, unknown> = await request.json().catch(() => ({}));
    const targetRunId = typeof body.targetRunId === "string" ? body.targetRunId.trim() : "";
    if (!targetRunId) return fail("targetRunId is required.");

    const result = await db.$transaction(async (tx) => {
      const litter = await tx.litter.findUnique({
        where: { id: litterId },
        select: { id: true, bredByKennelId: true },
      });
      if (!litter || litter.bredByKennelId !== kennel.id) {
        throw new KennelRunServiceError("Litter not found.", 404);
      }

      const puppy = await tx.dog.findUnique({
        where: { id: dogId },
        select: { id: true, litterId: true, ownerKennelId: true },
      });
      if (!puppy || puppy.litterId !== litter.id) {
        throw new KennelRunServiceError("Puppy not found in this litter.", 404);
      }
      if (puppy.ownerKennelId !== kennel.id) {
        throw new KennelRunServiceError(
          "This puppy is no longer owned by your kennel.",
          403
        );
      }

      const targetRun = await tx.kennelRun.findUnique({
        where: { id: targetRunId },
        select: { id: true, kennelId: true },
      });
      if (!targetRun || targetRun.kennelId !== kennel.id) {
        throw new KennelRunServiceError("Target Kennel Run not found.", 404);
      }

      return moveDogsToKennelRun({
        kennelId: kennel.id,
        dogIds: [dogId],
        targetRunId,
        client: tx,
      });
    });

    return ok(result);
  } catch (error) {
    if (error instanceof KennelRunServiceError) {
      return fail(error.message, error.status);
    }

    console.error("PATCH /api/litters/[litterId]/puppies/[dogId]/kennel-run failed:", error);
    return fail("Unable to move puppy to Kennel Run.", 500);
  }
}
