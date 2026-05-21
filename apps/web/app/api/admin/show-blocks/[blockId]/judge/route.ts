import { NextResponse } from "next/server";

import { getCurrentEpoch } from "@/lib/gameClock";
import { judgeShowBlock } from "@/server/services/judging.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ blockId: string }> }
) {
  let redirectTo: string | null = null;

  try {
    const { blockId } = await params;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("form")) {
      const formData = await request.formData();
      redirectTo = String(formData.get("redirectTo") ?? "").trim() || null;
    }

    const result = await judgeShowBlock({
      judgingBlockId: blockId,
      currentEpoch: getCurrentEpoch(),
    });

    if (redirectTo) {
      const url = new URL(redirectTo, request.url);
      url.searchParams.set("judged", "1");
      url.searchParams.set("judgedEntries", String(result.eligibleEntryCount));
      return NextResponse.redirect(url);
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/admin/show-blocks/[blockId]/judge failed:", error);

    if (redirectTo) {
      const url = new URL(redirectTo, request.url);
      url.searchParams.set(
        "judgeError",
        error instanceof Error ? error.message : "Failed to judge show block."
      );
      return NextResponse.redirect(url);
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to judge show block.",
      },
      { status: 400 }
    );
  }
}
