import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/session";
import { ArtworkCompletionError, completeArtCampaignArtwork } from "@/server/services/artworkCompletion.service";

export async function POST(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const body: unknown = await request.json();
    const input = body && typeof body === "object" ? body as { artistCredit?: unknown; assetReference?: unknown } : {};
    const { campaignId } = await params;
    const result = await completeArtCampaignArtwork({ userId, campaignId, artistCredit: input.artistCredit, assetReference: input.assetReference });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof ArtworkCompletionError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("POST /api/admin/breed-art/[campaignId]/complete failed");
    return NextResponse.json({ ok: false, error: "Unable to complete artwork campaign." }, { status: 500 });
  }
}
