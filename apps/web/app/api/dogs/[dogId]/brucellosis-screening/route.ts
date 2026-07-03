import { NextResponse } from "next/server";

import { redirectToDogPageWithField } from "@/lib/dogPageRedirect";
import { formatDogDisplayName } from "@/lib/dogNames";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { runBrucellosisTest } from "@/server/services/infectiousDisease.service";
import {
  BRUCELLOSIS_DISEASE_CODE,
  BRUCELLOSIS_TEST_FEE,
} from "@showring/rules";

class BrucellosisScreeningError extends Error {}

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

    const result = await db.$transaction(async (tx) => {
      const dog = await tx.dog.findUnique({
        where: { id: dogId },
        select: {
          id: true,
          ownerKennelId: true,
          lifecycleState: true,
          registeredName: true,
          callName: true,
          regNumber: true,
          visibleTitlePrefix: true,
          visibleTitleSuffix: true,
        },
      });

      if (!dog) {
        throw new BrucellosisScreeningError("Dog not found.");
      }

      if (dog.ownerKennelId !== kennel.id) {
        throw new BrucellosisScreeningError(
          "You can only screen dogs owned by your kennel."
        );
      }

      if (dog.lifecycleState !== "ALIVE") {
        throw new BrucellosisScreeningError(
          "Only living dogs can complete brucellosis screening."
        );
      }

      const currentKennel = await tx.kennel.findUnique({
        where: { id: kennel.id },
        select: { id: true, balance: true },
      });

      if (!currentKennel) {
        throw new BrucellosisScreeningError("Kennel not found.");
      }

      if (currentKennel.balance < BRUCELLOSIS_TEST_FEE) {
        throw new BrucellosisScreeningError(
          "Insufficient funds for brucellosis screening."
        );
      }

      const test = await runBrucellosisTest(tx, {
        dogId: dog.id,
        currentEpoch,
      });
      const balanceAfter = currentKennel.balance - BRUCELLOSIS_TEST_FEE;

      await tx.kennel.update({
        where: { id: currentKennel.id },
        data: { balance: balanceAfter },
      });

      await tx.ledgerTransaction.create({
        data: {
          kennelId: currentKennel.id,
          transactionType: "HEALTH_TEST_FEE",
          amount: -BRUCELLOSIS_TEST_FEE,
          balanceAfter,
          occurredAtEpoch: currentEpoch,
          dogId: dog.id,
          memo: `Brucellosis screening for ${formatDogDisplayName(dog)}.`,
          metadataJson: {
            diseaseCode: BRUCELLOSIS_DISEASE_CODE,
            resultCode: test.resultCode,
          },
        },
      });

      return {
        resultCode: test.resultCode,
      };
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
