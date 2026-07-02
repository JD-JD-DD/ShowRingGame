import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  KennelRunServiceError,
  deleteKennelRun,
  updateKennelRun,
} from "@/server/services/kennelRunManagement.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const body = await request.json().catch(() => ({}));
    const run = await updateKennelRun({
      kennelId: kennel.id,
      runId,
      name: body.name,
      sortOrder: body.sortOrder,
    });

    return ok({ run });
  } catch (error) {
    if (error instanceof KennelRunServiceError) {
      return fail(error.message, error.status);
    }

    console.error("PATCH /api/kennel/runs/[runId] failed:", error);
    return fail("Unable to update Kennel Run.", 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const result = await deleteKennelRun({
      kennelId: kennel.id,
      runId,
    });

    return ok(result);
  } catch (error) {
    if (error instanceof KennelRunServiceError) {
      return fail(error.message, error.status);
    }

    console.error("DELETE /api/kennel/runs/[runId] failed:", error);
    return fail("Unable to delete Kennel Run.", 500);
  }
}
