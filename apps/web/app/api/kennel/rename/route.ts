import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import {
  KennelRenameError,
  renameKennel,
} from "@/server/services/kennel.service";

function statusForRenameErrorCode(code: KennelRenameError["code"]): number {
  switch (code) {
    case "KENNEL_NOT_FOUND":
      return 404;
    case "UNAUTHORIZED_OWNERSHIP":
      return 403;
    case "MODERATION_RESTRICTED":
      return 403;
    case "RENAME_ALREADY_USED":
      return 409;
    case "NAME_ALREADY_TAKEN":
      return 409;
    case "INVALID_NAME":
      return 400;
    case "PROHIBITED_NAME":
      return 400;
    case "NO_ACTUAL_NAME_CHANGE":
      return 400;
    default:
      return 400;
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized.", code: "UNAUTHORIZED_OWNERSHIP" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const nextKennel = await renameKennel({
      userId,
      newName: body.name,
      source: "SELF_SERVICE",
    });

    return NextResponse.json({
      ok: true,
      kennel: nextKennel,
      nextPath: "/account?renamed=1",
    });
  } catch (error) {
    if (error instanceof KennelRenameError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: statusForRenameErrorCode(error.code) }
      );
    }

    console.error("POST /api/kennel/rename failed:", error);

    return NextResponse.json(
      { error: "Failed to rename kennel." },
      { status: 500 }
    );
  }
}
