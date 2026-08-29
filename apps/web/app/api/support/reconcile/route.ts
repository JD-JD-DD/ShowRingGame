import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import {
  reconcilePayPalSupportSubscription,
  SupportSubscriptionError,
} from "@/server/services/supportSubscription.service";
import { PayPalSupportError } from "@/server/services/paypalSupport.service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);

    const subscription = await reconcilePayPalSupportSubscription({ userId });
    return ok({ subscription });
  } catch (error) {
    if (error instanceof SupportSubscriptionError) return fail(error.message, error.status);
    if (error instanceof PayPalSupportError) {
      return fail("Your support status could not be verified with PayPal right now. No support data was changed.", 502);
    }
    console.error("POST /api/support/reconcile failed");
    return fail("Your support status could not be verified with PayPal right now. No support data was changed.", 500);
  }
}
