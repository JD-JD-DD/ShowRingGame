import { NextResponse } from "next/server";

import { redirectToDogPageWithField } from "@/lib/dogPageRedirect";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  BrucellosisScreeningError,
  runBrucellosisScreeningForKennel,
} from "@/server/services/infectiousDisease.service";

function formatResultLabel(resultCode: string): string {
  return resultCode === "NEGATIVE" ? "Negative" : "Positive";
}

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

    const currentEpoch = getCurrentEpoch();

    const result = await runBrucellosisScreeningForKennel({
      kennelId: kennel.id,
      dogId,
      currentEpoch,
    });

    return redirectToDogPageWithField(
      request,
      dogId,
      "healthMessage",
      `Brucellosis screening completed: ${formatResultLabel(result.resultCode)}.`
    );
  } catch (error) {
    console.error(
      "POST /api/dogs/[dogId]/brucellosis-screening failed:",
      error
    );

    return redirectToDogPageWithField(
      request,
      dogId,
      "healthError",
      error instanceof BrucellosisScreeningError
        ? error.message
        : "Unable to complete brucellosis screening."
    );
  }
}
