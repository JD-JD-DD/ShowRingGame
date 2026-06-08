import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { getKennelForUser } from "@/server/services/kennel.service";
import { claimStewardingAssignment } from "@/server/services/kennelService.service";

function redirectToServices(
  request: Request,
  params: { message?: string; error?: string }
) {
  const url = new URL("/kennel/services", request.url);
  if (params.message) url.searchParams.set("message", params.message);
  if (params.error) url.searchParams.set("error", params.error);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return NextResponse.json({ error: "Kennel not found." }, { status: 404 });
    }

    const formData = await request.formData();
    const showClusterId = String(formData.get("showClusterId") ?? "").trim();

    if (!showClusterId) {
      return redirectToServices(request, {
        error: "Choose a show to steward.",
      });
    }

    const result = await claimStewardingAssignment({
      kennelId: kennel.id,
      showClusterId,
      currentEpoch: getCurrentEpoch(),
    });

    return redirectToServices(request, {
      message: `Stewarding assignment claimed. $${result.payoutAmount.toLocaleString()} was paid to your kennel.`,
    });
  } catch (error) {
    console.error("POST /api/kennel/services/stewarding/claim failed:", error);
    return redirectToServices(request, {
      error:
        error instanceof Error
          ? error.message
          : "Unable to claim stewarding assignment.",
    });
  }
}
