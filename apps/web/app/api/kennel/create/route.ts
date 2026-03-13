import { NextResponse } from "next/server";
import { LedgerTransactionType } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const STARTER_FUNDS = 25000;

function makeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function getCurrentEpoch(): number {
  return Math.floor(Date.now() / (1000 * 60 * 60));
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const existingKennel = await db.kennel.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingKennel) {
      return NextResponse.json(
        { error: "This account already has a kennel." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const homeDistrict = Number(body.homeDistrict);

    if (!name) {
      return NextResponse.json(
        { error: "Kennel name is required." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(homeDistrict) || homeDistrict < 1 || homeDistrict > 15) {
      return NextResponse.json(
        { error: "homeDistrict must be an integer from 1 to 15." },
        { status: 400 }
      );
    }

    const slugBase = makeSlug(name);
    if (!slugBase) {
      return NextResponse.json(
        { error: "Kennel name must contain letters or numbers." },
        { status: 400 }
      );
    }

    const existingName = await db.kennel.findUnique({
      where: { name },
      select: { id: true },
    });

    if (existingName) {
      return NextResponse.json(
        { error: "That kennel name is already taken." },
        { status: 409 }
      );
    }

    let slug = slugBase;
    let counter = 2;

    while (true) {
      const existingSlug = await db.kennel.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existingSlug) break;
      slug = `${slugBase}-${counter}`;
      counter += 1;
    }

    const result = await db.$transaction(async (tx) => {
      const kennel = await tx.kennel.create({
        data: {
          userId,
          name,
          slug,
          homeDistrict,
          balance: STARTER_FUNDS,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          homeDistrict: true,
          balance: true,
          reputationScore: true,
        },
      });

      await tx.ledgerTransaction.create({
        data: {
          kennelId: kennel.id,
          transactionType: LedgerTransactionType.STARTER_FUNDS,
          amount: STARTER_FUNDS,
          balanceAfter: STARTER_FUNDS,
          occurredAtEpoch: getCurrentEpoch(),
          memo: "Starter funds for new kennel creation",
        },
      });

      return kennel;
    });

    return NextResponse.json({
      ok: true,
      kennel: result,
      nextPath: "/kennel",
    });
  } catch (error) {
    console.error("POST /api/kennel/create failed:", error);
    return NextResponse.json(
      { error: "Failed to create kennel." },
      { status: 500 }
    );
  }
}