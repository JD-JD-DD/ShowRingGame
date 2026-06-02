import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { runPhenotypeHealthTestForKennel } from "@/server/services/healthTest.service";

function redirectWithHealthMessage(
  request: Request,
  dogId: string,
  field: "healthError" | "healthMessage",
  message: string
) {
  const url = new URL(`/dogs/${dogId}`, request.url);
  url.searchParams.set(field, message);
  return NextResponse.redirect(url);
}

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ dogId: string; testTypeCode: string }> }
) {
  const { dogId, testTypeCode } = await params;

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    await runPhenotypeHealthTestForKennel({
      kennelId: kennel.id,
      dogId,
      testTypeCode,
      currentEpoch: getCurrentEpoch(),
    });

    return redirectWithHealthMessage(
      request,
      dogId,
      "healthMessage",
      "Health test completed."
    );
  } catch (error) {
    console.error(
      "POST /api/dogs/[dogId]/health-tests/[testTypeCode] failed:",
      error
    );

    return redirectWithHealthMessage(
      request,
      dogId,
      "healthError",
      error instanceof Error ? error.message : "Failed to complete health test."
    );
  }
}
