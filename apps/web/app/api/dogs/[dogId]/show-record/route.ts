import { fail } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getDogShowRecord } from "@/server/services/dog.service";

type RouteProps = {
  params: Promise<{
    dogId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const { dogId } = await params;
    const results = await getDogShowRecord({ dogId });

    if (!results) {
      return fail("Dog not found.", 404);
    }

    return Response.json({
      dogId,
      results,
    });
  } catch (error) {
    console.error("GET /api/dogs/[dogId]/show-record failed", error);
    return fail("Unable to load dog show record.", 500);
  }
}
