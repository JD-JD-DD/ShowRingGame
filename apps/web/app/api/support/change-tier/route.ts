import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { fail, ok } from "@/lib/http";
import { getSessionUserId } from "@/lib/session";
import { isSupportTier, PayPalSupportError } from "@/server/services/paypalSupport.service";
import { createPayPalSupportSubscriptionChange, SupportSubscriptionError } from "@/server/services/supportSubscription.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);
    const body: unknown = await request.json();
    const tier = body !== null && typeof body === "object" && "tier" in body ? (body as { tier?: unknown }).tier : undefined;
    if (!isSupportTier(tier)) return fail("A valid support tier is required.", 400);
    const baseUrl = getAppBaseUrl(request);
    const change = await createPayPalSupportSubscriptionChange({
      userId, tier,
      returnUrl: new URL("/account/settings/support?paypal=approved", baseUrl).toString(),
      cancelUrl: new URL("/account/settings/support?paypal=cancelled", baseUrl).toString(),
    });
    return ok({ change });
  } catch (error) {
    if (error instanceof SupportSubscriptionError || error instanceof PayPalSupportError) return fail(error.message, error.status);
    console.error("POST /api/support/change-tier failed");
    return fail("Unable to change your support level right now.", 500);
  }
}
