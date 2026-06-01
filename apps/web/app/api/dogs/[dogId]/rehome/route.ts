import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getPuppyRehomePayout } from "@showring/rules";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  try {
    const { dogId } = await params;
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

    const dog = await db.dog.findUnique({
      where: { id: dogId },
      select: {
        id: true,
        birthEpoch: true,
        ownerKennelId: true,
        lifecycleState: true,
        marketState: true,
      },
    });

    if (!dog) {
      return NextResponse.json({ error: "Dog not found." }, { status: 404 });
    }

    if (dog.ownerKennelId !== kennel.id) {
      return NextResponse.json({ error: "You do not own this dog." }, { status: 403 });
    }

    if (dog.lifecycleState !== "ALIVE") {
      return NextResponse.json(
        { error: "Only active dogs can be re-homed." },
        { status: 400 }
      );
    }

    if (dog.marketState !== "NOT_FOR_SALE") {
      return NextResponse.json(
        { error: "Dogs listed for sale must be removed from the market before re-homing." },
        { status: 400 }
      );
    }

    const payout = getPuppyRehomePayout(currentEpoch, dog.birthEpoch);

    await db.$transaction(async (tx) => {
      const transfer = await tx.dog.updateMany({
        where: {
          id: dogId,
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

      if (transfer.count !== 1) {
        throw new Error("Dog is no longer available to re-home.");
      }

      if (payout === 0) {
        return;
      }

      const updatedKennel = await tx.kennel.update({
        where: { id: kennel.id },
        data: { balance: { increment: payout } },
        select: { balance: true },
      });

      await tx.ledgerTransaction.create({
        data: {
          kennelId: kennel.id,
          transactionType: "PUPPY_REHOME",
          amount: payout,
          balanceAfter: updatedKennel.balance,
          occurredAtEpoch: currentEpoch,
          dogId,
          memo: "Baseline puppy re-home placement",
        },
      });
    });

    return NextResponse.redirect(new URL("/kennel", request.url));
  } catch (error) {
    console.error("POST /api/dogs/[dogId]/rehome failed:", error);

    return NextResponse.json(
      { error: "Failed to re-home dog." },
      { status: 500 }
    );
  }
}
