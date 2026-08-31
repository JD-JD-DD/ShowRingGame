import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { ArtPaymentAttemptError, PayPalSupportError, startArtPaymentAttempt } from "@/server/services/artPaymentAttempt.service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Sign in to start a Breed Art contribution.", 401);
    const body: unknown = await request.json();
    const input = body !== null && typeof body === "object" ? body as Record<string, unknown> : {};
    const { campaignId } = await params;
    const checkout = await startArtPaymentAttempt({
      userId,
      campaignId,
      requestedUnits: input.requestedUnits,
      recognition: input.recognition,
      nonRefundableAcknowledged: input.nonRefundableAcknowledged,
      clientRequestId: input.clientRequestId,
      appBaseUrl: getAppBaseUrl(request),
    });
    return ok(checkout);
  } catch (error) {
    if (error instanceof ArtPaymentAttemptError || error instanceof PayPalSupportError) return fail(error.message, error.status);
    console.error("POST /api/art-campaigns/[campaignId]/checkout failed");
    return fail("Unable to start Breed Art checkout.", 500);
  }
}
