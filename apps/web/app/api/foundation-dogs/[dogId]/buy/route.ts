import { getSessionUserId } from "@/lib/session";
import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { buyFoundationDog } from "@/server/services/foundationDog.service";
import { getCurrentEpoch } from "@/lib/gameClock";

type RouteContext = {
  params: {
    dogId: string;
  };
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await db.kennel.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!kennel) {
      return fail("Kennel not found for current user.", 404);
    }

    const { dogId } = context.params;

    if (!dogId) {
      return fail("dogId route parameter is required.", 400);
    }

    const currentEpoch = getCurrentEpoch();

    const dog = await buyFoundationDog({
      dogId,
      kennelId: kennel.id,
      currentEpoch,
    });

    return ok({ dog });
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message;

      if (message === "Kennel not found.") {
        return fail(message, 404);
      }

      if (
        message === "Foundation dog not found." ||
        message === "Dog already sold."
      ) {
        return fail(message, 409);
      }

      if (message === "Insufficient funds.") {
        return fail(message, 400);
      }
    }

    console.error("POST /api/foundation-dogs/[dogId]/buy failed", error);
    return fail("Unable to purchase foundation dog.", 500);
  }
}
