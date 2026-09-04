import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import {
  publishStudOffer,
  StudOfferPublishError,
  retirePublishedStudOfferForOwner,
  StudOfferRetireError,
} from "@/server/services/studOffer.service";
import type { EditableStudOfferTerms } from "@showring/rules";

function isTerms(value: unknown): value is EditableStudOfferTerms {
  if (!value || typeof value !== "object") return false;
  const terms = value as Partial<EditableStudOfferTerms>;
  return Array.isArray(terms.healthRequirements) && terms.healthRequirements.every(
    (requirement) =>
      requirement &&
      typeof requirement.healthTestCode === "string" &&
      "requirementLevel" in requirement
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);
    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const body: unknown = await request.json();
    const terms =
      body && typeof body === "object"
        ? (body as { terms?: unknown }).terms
        : undefined;
    const baseVersion =
      body && typeof body === "object" && typeof (body as { baseVersion?: unknown }).baseVersion === "number"
        ? (body as { baseVersion: number }).baseVersion
        : null;
    if (!isTerms(terms)) {
      return NextResponse.json(
        { error: "Stud Offer terms are invalid." },
        { status: 400 }
      );
    }

    const { dogId } = await params;
    const offer = await publishStudOffer({
      dogId,
      ownerKennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
      terms,
      baseVersion,
    });

    return NextResponse.json({ offerId: offer.offerId, version: offer.version });
  } catch (error) {
    if (error instanceof StudOfferPublishError) {
      const status =
        error.code === "NOT_OWNER"
          ? 403
          : error.code === "ALREADY_PUBLISHED"
            ? 409
            : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("POST /api/dogs/[dogId]/stud-offer failed:", error);
    return NextResponse.json(
      { error: "Unable to publish this Stud Offer. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ dogId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);
    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const { dogId: rawDogId } = await params;
    const dogId = rawDogId.trim();
    if (!dogId) {
      return NextResponse.json({ error: "Dog is required." }, { status: 400 });
    }

    const offer = await retirePublishedStudOfferForOwner({
      dogId,
      ownerKennelId: kennel.id,
    });
    return NextResponse.json({ offerId: offer.offerId, version: offer.version });
  } catch (error) {
    if (error instanceof StudOfferRetireError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "NOT_OWNER" ? 403 : 409 }
      );
    }

    console.error("DELETE /api/dogs/[dogId]/stud-offer failed:", error);
    return NextResponse.json(
      { error: "Unable to take down this Stud Offer. Please try again." },
      { status: 500 }
    );
  }
}
