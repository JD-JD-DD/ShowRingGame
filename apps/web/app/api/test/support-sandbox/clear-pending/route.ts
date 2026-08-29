import { fail, ok } from "@/lib/http";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { createPayPalSandboxClient } from "@/server/services/paypalSupport.service";
import { getPayPalPlanId, getPayPalSupportConfig } from "@/server/services/paypalSupport.service";

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return fail("Unauthorized.", 401);
    const subscription = await (db as any).supportSubscription.findFirst({ where: { userId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    if (!subscription) return fail("No pending sandbox test subscription is available to clear.", 409);
    if (subscription.provider !== "PAYPAL") return fail("The pending subscription cannot be cleared by this test tool.", 409);
    const paypal = createPayPalSandboxClient();
    const current = await paypal.getSubscription(subscription.providerSubscriptionId);
    if (current.status !== "APPROVAL_PENDING" || current.planId !== getPayPalPlanId(subscription.currentTier, getPayPalSupportConfig())) return fail("The pending PayPal sandbox subscription is no longer eligible to clear. No ShowRing subscription data was changed.", 409);
    await paypal.cancelSubscription(subscription.providerSubscriptionId);
    const afterCancel = await paypal.getSubscription(subscription.providerSubscriptionId);
    if (afterCancel.status === "APPROVAL_PENDING") return fail("The pending PayPal sandbox subscription could not be cleared. No ShowRing subscription data was changed.", 502);
    await (db as any).supportSubscription.update({ where: { id: subscription.id }, data: { status: "ENDED", endedAt: new Date() } });
    return ok({ message: "Pending sandbox test subscription cleared. You may create one new Bronze sandbox subscription." });
  } catch { return fail("The pending PayPal sandbox subscription could not be cleared. No ShowRing subscription data was changed.", 502); }
}
