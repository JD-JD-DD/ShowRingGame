import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { ArtPaymentAttemptError } from "@/server/services/artPaymentAttempt.service";
import { finalizeArtPaymentAttempt } from "@/server/services/artPaymentFinalization.service";
import { PayPalSupportError } from "@/server/services/paypalSupport.service";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Sign in to finalize your Breed Art contribution.", 401);
    const { attemptId } = await params;
    return ok(await finalizeArtPaymentAttempt({ userId, attemptId }));
  } catch (error) {
    if (error instanceof ArtPaymentAttemptError || error instanceof PayPalSupportError) return fail(error.message, error.status);
    console.error("POST /api/art-payments/[attemptId]/finalize failed");
    return fail("Unable to finalize Breed Art contribution.", 500);
  }
}
