import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  LitterMetadataError,
  updateLitterMetadata,
  type LitterMetadataInput,
} from "@/server/services/litter.service";

type RouteProps = {
  params: Promise<{
    litterId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON.", 400);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid metadata request.", 400);
    }

    const { litterId } = await params;
    const metadata = await updateLitterMetadata({
      kennelId: kennel.id,
      litterId,
      input: body as LitterMetadataInput,
    });

    return ok(metadata);
  } catch (error) {
    if (error instanceof LitterMetadataError) {
      return fail(error.message, error.status);
    }

    console.error("PATCH /api/litters/[litterId]/metadata failed", error);
    return fail("Unable to save litter metadata.", 500);
  }
}
