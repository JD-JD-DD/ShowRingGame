import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { deleteReadKennelInboxNotices } from "@/server/services/kennelNotice.service";

function redirectWithMessage(
  request: Request,
  params: { message?: string; error?: string }
) {
  const url = new URL("/notices", request.url);
  if (params.message) url.searchParams.set("message", params.message);
  if (params.error) url.searchParams.set("error", params.error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.redirect(new URL("/login", request.url), 303);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.redirect(new URL("/onboarding", request.url), 303);
    }

    const result = await deleteReadKennelInboxNotices({
      kennelId: kennel.id,
      currentEpoch: getCurrentEpoch(),
    });

    return redirectWithMessage(request, {
      message:
        result.deletedCount > 0
          ? "Deleted read notices."
          : "No read notices to delete.",
    });
  } catch (error) {
    console.error("POST /api/notices/delete-read failed:", error);
    return redirectWithMessage(request, {
      error: "Unable to delete read notices.",
    });
  }
}
