import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ areaId: string }> }
) {
  try {
    const { areaId } = await params;
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const area = await db.kennelArea.findUnique({
      where: { id: areaId },
      select: {
        id: true,
        name: true,
        kennelId: true,
      },
    });

    // Ownership guard: only the kennel that created this custom area
    // can remove it, even if someone tries to call the API directly.
    if (!area || area.kennelId !== kennel.id) {
      return fail("Kennel area not found.", 404);
    }

    await db.kennelArea.delete({
      where: { id: area.id },
    });

    return ok({ areaId: area.id, areaName: area.name });
  } catch (error) {
    console.error("DELETE /api/kennel/areas/[areaId] failed:", error);
    return fail("Unable to delete kennel area.", 500);
  }
}
