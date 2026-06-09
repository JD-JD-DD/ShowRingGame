import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { cancelGroomingListing } from "@/server/services/grooming.service";

function redirectWithMessage(
  request: Request,
  returnTo: string | null,
  params: { message?: string; error?: string }
) {
  const url = new URL(returnTo || "/kennel", request.url);
  if (params.message) url.searchParams.set("message", params.message);
  if (params.error) url.searchParams.set("error", params.error);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  let returnTo: string | null = null;

  try {
    if (!isJson) {
      const formData = await request.formData();
      returnTo = String(formData.get("returnTo") ?? "").trim() || null;
    }

    const userId = await getSessionUserId();

    if (!userId) {
      return isJson
        ? fail("Unauthorized.", 401)
        : redirectWithMessage(request, returnTo, { error: "Unauthorized." });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return isJson
        ? fail("Kennel not found.", 404)
        : redirectWithMessage(request, returnTo, { error: "Kennel not found." });
    }

    const { listingId } = await params;
    await cancelGroomingListing({
      kennelId: kennel.id,
      listingId,
    });

    return isJson
      ? ok({ message: "Grooming listing cancelled." })
      : redirectWithMessage(request, returnTo, {
          message: "Grooming listing cancelled.",
        });
  } catch (error) {
    console.error(
      "POST /api/services/grooming/listings/[listingId]/cancel failed:",
      error
    );
    const message =
      error instanceof Error
        ? error.message
        : "Unable to cancel grooming listing.";

    return isJson
      ? fail(message)
      : redirectWithMessage(request, returnTo, { error: message });
  }
}
