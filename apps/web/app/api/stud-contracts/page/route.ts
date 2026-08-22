import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { listStudContractsForKennel } from "@/server/services/studContractHistory.service";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);
    const kennel = await getKennelForUser(userId);
    if (!kennel) return fail("Kennel not found.", 404);
    const body = await request.json();
    const cursor = typeof body.cursor === "string" && body.cursor.trim() ? body.cursor.trim() : null;
    return ok(await listStudContractsForKennel({ kennelId: kennel.id, cursor }));
  } catch (error) {
    console.error("POST /api/stud-contracts/page failed", error);
    return fail("Unable to load Stud Contracts.", 500);
  }
}
