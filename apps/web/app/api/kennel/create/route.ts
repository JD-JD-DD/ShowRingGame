import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";

type KennelCreateTx = {
  kennel: typeof db.kennel;
  ledgerTransaction: typeof db.ledgerTransaction;
};

const STARTER_FUNDS = 25000;
const DISTRICT_COUNT = 15;

function makeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function chooseHomeDistrict(): Promise<number> {
  const districtCounts = await db.kennel.groupBy({
    by: ["homeDistrict"],
    where: {
      isNpc: false,
      homeDistrict: {
        not: null,
      },
    },
    _count: {
      homeDistrict: true,
    },
  });

  const counts = new Map<number, number>();

  for (let district = 1; district <= DISTRICT_COUNT; district += 1) {
    counts.set(district, 0);
  }

  for (const row of districtCounts) {
    if (row.homeDistrict !== null) {
      counts.set(row.homeDistrict, row._count.homeDistrict);
    }
  }

  let minCount = Number.POSITIVE_INFINITY;
  for (const count of counts.values()) {
    if (count < minCount) {
      minCount = count;
    }
  }

  const leastPopulatedDistricts = Array.from(counts.entries())
    .filter(([, count]) => count === minCount)
    .map(([district]) => district);

  const randomIndex = Math.floor(Math.random() * leastPopulatedDistricts.length);
  return leastPopulatedDistricts[randomIndex]!;
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
    const publicSlogan =
      typeof body.publicSlogan === "string" && body.publicSlogan.trim()
        ? body.publicSlogan.trim()
        : null;

    if (!name) {
      return NextResponse.json(
        { error: "Kennel name is required." },
        { status: 400 }
      );
    }

    if (name.length > 45) {
      return NextResponse.json(
        { error: "Kennel name must be 45 characters or fewer." },
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

    const homeDistrict = await chooseHomeDistrict();

const kennel = await db.$transaction(async (tx: KennelCreateTx) => {
  const createdKennel = await tx.kennel.create({
    data: {
      userId,
      name,
      slug,
      homeDistrict,
      publicSlogan,
      balance: STARTER_FUNDS,
      reputationScore: 0,
      isNpc: false,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      homeDistrict: true,
      publicSlogan: true,
      balance: true,
      reputationScore: true,
    },
  });

  await tx.ledgerTransaction.create({
    data: {
      kennelId: createdKennel.id,
      transactionType: "STARTER_FUNDS",
      amount: STARTER_FUNDS,
      balanceAfter: STARTER_FUNDS,
      occurredAtEpoch: getCurrentEpoch(),
      memo: "Starter funds for new kennel creation",
    },
  });

  return createdKennel;
});

    return NextResponse.json({
      ok: true,
      kennel,
      nextPath: "/kennel",
    });
  } catch (error) {
    console.error("POST /api/kennel/create failed:", error);

    return NextResponse.json(
      {
        error: "Failed to create kennel.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
