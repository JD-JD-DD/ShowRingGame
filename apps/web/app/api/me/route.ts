import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await db.kennel.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        slug: true,
        homeDistrict: true,
        balance: true,
        reputationScore: true,
        _count: {
          select: {
            ownedDogs: true,
          },
        },
      },
    });

    if (!kennel) {
      return NextResponse.json({ kennel: null }, { status: 404 });
    }

    return NextResponse.json({
      kennel: {
        id: kennel.id,
        name: kennel.name,
        slug: kennel.slug,
        homeDistrict: kennel.homeDistrict,
        balance: kennel.balance,
        reputationScore: kennel.reputationScore,
        dogCount: kennel._count.ownedDogs,
      },
    });
  } catch (error) {
    console.error("GET /api/kennel/me failed:", error);
    return NextResponse.json(
      { error: "Failed to load kennel." },
      { status: 500 }
    );
  }
}
