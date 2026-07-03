import { NextResponse } from "next/server";

import { redirectToDogPageWithField } from "@/lib/dogPageRedirect";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { runPhenotypeHealthTestsForKennel } from "@/server/services/healthTest.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  const { dogId } = await params;

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const testTypeCodes = formData
      .getAll("testTypeCodes")
      .filter((value): value is string => typeof value === "string");

    const records = await runPhenotypeHealthTestsForKennel({
      kennelId: kennel.id,
      dogId,
      testTypeCodes,
      currentEpoch: getCurrentEpoch(),
    });

    return redirectToDogPageWithField(
      request,
      dogId,
      "healthMessage",
      records.length === 1
        ? "Health test completed."
        : `${records.length} health tests completed.`
    );
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/health-tests failed:", error);

    return redirectToDogPageWithField(
      request,
      dogId,
      "healthError",
      error instanceof Error
        ? error.message
        : "Failed to complete selected health tests."
    );
  }
}
