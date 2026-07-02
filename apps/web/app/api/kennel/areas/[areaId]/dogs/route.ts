import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";

type AreaDogsAction = "add" | "remove";

// Legacy kennel areas add/remove many-to-many memberships. This is tagging-style
// grouping, not moving dogs. Kennel Runs should use a future move endpoint that
// updates Dog.kennelRunId exactly once per dog.
function uniqueDogIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((dogId) => String(dogId).trim())
        .filter((dogId) => dogId.length > 0)
    ),
  ];
}

export async function POST(
  request: Request,
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
      select: { id: true, kennelId: true },
    });

    if (!area || area.kennelId !== kennel.id) {
      return fail("Kennel area not found.", 404);
    }

    const body = (await request.json()) as {
      dogIds?: unknown;
      action?: unknown;
    };
    const dogIds = uniqueDogIds(body.dogIds);
    const action = String(body.action ?? "") as AreaDogsAction;

    if (dogIds.length === 0) {
      return fail("Select at least one dog.", 400);
    }

    if (action !== "add" && action !== "remove") {
      return fail("Choose whether to add or remove dogs from the area.", 400);
    }

    const ownedDogCount = await db.dog.count({
      where: {
        id: { in: dogIds },
        ownerKennelId: kennel.id,
        lifecycleState: "ALIVE",
      },
    });

    if (ownedDogCount !== dogIds.length) {
      return fail("One or more selected dogs are not in your kennel.", 403);
    }

    if (action === "add") {
      await db.kennelAreaDog.createMany({
        data: dogIds.map((dogId) => ({
          kennelAreaId: area.id,
          dogId,
        })),
        skipDuplicates: true,
      });
    } else {
      await db.kennelAreaDog.deleteMany({
        where: {
          kennelAreaId: area.id,
          dogId: { in: dogIds },
        },
      });
    }

    return ok({ areaId: area.id, dogIds, action });
  } catch (error) {
    console.error("POST /api/kennel/areas/[areaId]/dogs failed:", error);
    return fail("Unable to update kennel area.", 500);
  }
}
