import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  parsePlannerTagType,
  saveProgramPlannerTags,
} from "@/server/services/programPlanner.service";

const MAX_PLANNER_NOTE_LENGTH = 1200;

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const body = await request.json();
    const breedCode2 =
      typeof body.breedCode2 === "string" ? body.breedCode2.trim() : "";
    const goalKey =
      typeof body.goalKey === "string" ? body.goalKey.trim() : "";
    const rawTags = Array.isArray(body.tags) ? body.tags : [];

    if (!breedCode2) {
      return fail("breedCode2 is required.", 400);
    }

    if (!goalKey) {
      return fail("goalKey is required.", 400);
    }

    const tags = rawTags.map((rawTag: Record<string, unknown>) => {
      const tagType = parsePlannerTagType(rawTag?.tagType);
      const dogId = typeof rawTag?.dogId === "string" ? rawTag.dogId.trim() : "";
      const note = typeof rawTag?.note === "string" ? rawTag.note.trim() : "";

      if (!dogId || !tagType) {
        throw new Error("Each planner tag needs a dogId and valid tagType.");
      }

      if (note.length > MAX_PLANNER_NOTE_LENGTH) {
        throw new Error(
          `Planner notes cannot exceed ${MAX_PLANNER_NOTE_LENGTH.toLocaleString()} characters.`
        );
      }

      return {
        dogId,
        tagType,
        note,
        isVisibleOnDogPage: rawTag?.isVisibleOnDogPage === true,
      };
    });

    const result = await saveProgramPlannerTags({
      kennelId: kennel.id,
      breedCode2,
      goalKey,
      tags,
    });

    return ok({
      ...result,
      message: `Saved ${result.savedCount.toLocaleString()} planner tag${
        result.savedCount === 1 ? "" : "s"
      }.`,
    });
  } catch (error) {
    console.error("POST /api/kennel/program-planner/tags failed", error);
    return fail(
      error instanceof Error ? error.message : "Unable to save planner tags.",
      400
    );
  }
}
