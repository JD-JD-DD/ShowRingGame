import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { PayPalSupportError } from "@/server/services/paypalSupport.service";
import { cancelPayPalSupportSubscription, SupportSubscriptionError } from "@/server/services/supportSubscription.service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);
    return ok({ subscription: await cancelPayPalSupportSubscription({ userId }) });
  } catch (error) {
    if (error instanceof SupportSubscriptionError || error instanceof PayPalSupportError) return fail(error.message, error.status);
    console.error("POST /api/support/cancel failed");
    return fail("Unable to cancel your support right now.", 500);
  }
}
