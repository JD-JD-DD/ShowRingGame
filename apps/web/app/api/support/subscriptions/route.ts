import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { isSupportTier, PayPalSupportError } from "@/server/services/paypalSupport.service";
import {
  createPayPalSupportSubscription,
  SupportSubscriptionError,
} from "@/server/services/supportSubscription.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);

    const body: unknown = await request.json();
    const tier =
      body !== null && typeof body === "object" && "tier" in body
        ? (body as { tier?: unknown }).tier
        : undefined;
    if (!isSupportTier(tier)) {
      return fail("A valid support tier is required.", 400);
    }

    const subscription = await createPayPalSupportSubscription({ userId, tier });
    return ok({ subscription });
  } catch (error) {
    if (error instanceof SupportSubscriptionError || error instanceof PayPalSupportError) {
      return fail(error.message, error.status);
    }
    console.error("POST /api/support/subscriptions failed");
    return fail("Unable to create ShowRing Support subscription.", 500);
  }
}
