import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { canRehomeDog, getPuppyRehomePayout } from "@showring/rules";

export async function POST(request: Request) {
  try {
    const currentEpoch = getCurrentEpoch();
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await db.kennel.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const body = (await request.json()) as { dogIds?: unknown };
    const dogIds = Array.isArray(body.dogIds)
      ? body.dogIds
          .map((dogId) => String(dogId))
          .filter((dogId) => dogId.length > 0)
      : [];

    if (dogIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one dog to re-home." },
        { status: 400 }
      );
    }

    const dogs = await db.dog.findMany({
      where: {
        id: { in: dogIds },
        ownerKennelId: kennel.id,
        isPlayerVisible: true,
      },
      select: {
        id: true,
        birthEpoch: true,
        lifecycleState: true,
        marketState: true,
      },
    });

    if (dogs.length !== new Set(dogIds).size) {
      return NextResponse.json(
        { error: "One or more selected dogs could not be found in your kennel." },
        { status: 403 }
      );
    }

    const blockedDog = dogs.find(
      (dog) =>
        !canRehomeDog(currentEpoch, dog.birthEpoch, dog.lifecycleState) ||
        dog.marketState !== "NOT_FOR_SALE"
    );

    if (blockedDog) {
      return NextResponse.json(
        {
          error:
            "Only dogs at least 8 weeks old that are active and not listed for sale can be re-homed in bulk.",
        },
        { status: 400 }
      );
    }

    const dogsById = new Map(dogs.map((dog) => [dog.id, dog]));
    const payoutDogs = dogIds
      .map((dogId) => dogsById.get(dogId)!)
      .map((dog) => ({
        ...dog,
        payout: getPuppyRehomePayout(currentEpoch, dog.birthEpoch),
      }))
      .filter((dog) => dog.payout > 0);
    const creditsAdded = payoutDogs.reduce(
      (total, dog) => total + dog.payout,
      0
    );

    await db.$transaction(async (tx) => {
      const transfer = await tx.dog.updateMany({
        where: {
          id: { in: dogIds },
          ownerKennelId: kennel.id,
          lifecycleState: "ALIVE",
          marketState: "NOT_FOR_SALE",
        },
        data: {
          ownerKennelId: null,
          marketState: "NOT_FOR_SALE",
          lifecycleState: "TRANSFERRED",
        },
      });

      if (transfer.count !== dogIds.length) {
        throw new Error("One or more dogs are no longer available to re-home.");
      }

      await tx.kennelAreaDog.deleteMany({
        where: {
          dogId: { in: dogIds },
          area: {
            kennelId: kennel.id,
          },
        },
      });

      if (creditsAdded === 0) {
        return;
      }

      const updatedKennel = await tx.kennel.update({
        where: { id: kennel.id },
        data: { balance: { increment: creditsAdded } },
        select: { balance: true },
      });
      let runningBalance = updatedKennel.balance - creditsAdded;

      await tx.ledgerTransaction.createMany({
        data: payoutDogs.map((dog) => {
          runningBalance += dog.payout;

          return {
            kennelId: kennel.id,
            transactionType: "PUPPY_REHOME",
            amount: dog.payout,
            balanceAfter: runningBalance,
            occurredAtEpoch: currentEpoch,
            dogId: dog.id,
            memo: "Baseline puppy re-home placement",
          };
        }),
      });
    });

    return NextResponse.json({
      ok: true,
      rehomedCount: dogIds.length,
      creditsAdded,
      dogIds,
    });
  } catch (error) {
    console.error("POST /api/dogs/bulk-rehome failed:", error);

    return NextResponse.json(
      { error: "Failed to re-home selected dogs." },
      { status: 500 }
    );
  }
}
