import { db } from "@/lib/db";
import {
  createPayPalClient,
  getPayPalPlanId,
  getPayPalSupportConfig,
  type PayPalClient,
  type PayPalSupportSubscription,
  type SupportTierValue,
} from "@/server/services/paypalSupport.service";

export const CURRENT_SUPPORT_STATUSES = [
  "PENDING",
  "ACTIVE",
  "PAYMENT_RETRY",
  "CANCELLATION_SCHEDULED",
] as const;

type CanonicalSupportStatus = (typeof CURRENT_SUPPORT_STATUSES)[number] | "ENDED";

type SupportSubscriptionTransaction = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  supportSubscription: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string; status: CanonicalSupportStatus }>;
  };
};

type SupportSubscriptionDatabase = {
  $transaction<T>(callback: (transaction: SupportSubscriptionTransaction) => Promise<T>): Promise<T>;
};

export class SupportSubscriptionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export function translatePayPalStatus(args: {
  status: string;
  nextBillingTime?: Date | null;
}): CanonicalSupportStatus {
  const status = args.status;
  switch (status) {
    case "APPROVAL_PENDING":
    case "APPROVED":
      return "PENDING";
    case "ACTIVE":
      return "ACTIVE";
    case "SUSPENDED":
      return "PAYMENT_RETRY";
    case "CANCELLED":
      return args.nextBillingTime && args.nextBillingTime > new Date()
        ? "CANCELLATION_SCHEDULED"
        : "ENDED";
    case "EXPIRED":
      return "ENDED";
    default:
      throw new SupportSubscriptionError("PayPal subscription is not in a supported state.", 422);
  }
}

export function getSupportTierForPayPalPlan(planId: string): SupportTierValue {
  const config = getPayPalSupportConfig();
  const tier = (Object.entries(config.planIds) as Array<[SupportTierValue, string]>).find(
    ([, configuredPlanId]) => configuredPlanId === planId
  )?.[0];
  if (!tier) throw new SupportSubscriptionError("PayPal subscription plan is not configured for ShowRing Support.", 422);
  return tier;
}

export function verifyPayPalSubscription(args: {
  subscription: PayPalSupportSubscription;
  tier: SupportTierValue;
}): CanonicalSupportStatus {
  const config = getPayPalSupportConfig();
  if (args.subscription.planId !== getPayPalPlanId(args.tier, config)) {
    throw new SupportSubscriptionError("PayPal subscription plan does not match the selected support tier.", 422);
  }
  return translatePayPalStatus(args.subscription);
}

export type CreateSupportSubscriptionResult = {
  id: string;
  tier: SupportTierValue;
  status: CanonicalSupportStatus;
  approvalUrl: string | null;
};

/**
 * Creates a sandbox subscription only after serializing current-support checks
 * for the account, then verifies PayPal's returned subscription before linking it.
 */
export async function createPayPalSupportSubscription(args: {
  userId: string;
  tier: SupportTierValue;
  returnUrl: string;
  cancelUrl: string;
  database?: SupportSubscriptionDatabase;
  payPalClient?: PayPalClient;
}): Promise<CreateSupportSubscriptionResult> {
  const database = args.database ?? (db as unknown as SupportSubscriptionDatabase);
  const payPalClient = args.payPalClient ?? createPayPalClient();

  return database.$transaction(async (transaction) => {
    const users = await transaction.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "User" WHERE "id" = ${args.userId} FOR UPDATE
    `;
    if (users.length !== 1) {
      throw new SupportSubscriptionError("Account not found.", 404);
    }

    const existing = await transaction.supportSubscription.findFirst({
      where: { userId: args.userId, status: { in: CURRENT_SUPPORT_STATUSES } },
      select: { id: true },
    });
    if (existing) {
      throw new SupportSubscriptionError("This account already has a current support subscription.", 409);
    }

    const created = await payPalClient.createSubscription({
      tier: args.tier,
      returnUrl: args.returnUrl,
      cancelUrl: args.cancelUrl,
    });
    const verified = await payPalClient.getSubscription(created.providerSubscriptionId);
    const status = verifyPayPalSubscription({ subscription: verified, tier: args.tier });
    const supportedAt = status === "ACTIVE" ? verified.startTime ?? new Date() : null;
    const subscription = await transaction.supportSubscription.create({
      data: {
        userId: args.userId,
        provider: "PAYPAL",
        providerSubscriptionId: verified.id,
        currentTier: args.tier,
        status,
        currentPaidPeriodStart: supportedAt,
        currentPaidPeriodEnd: status === "ACTIVE" ? verified.nextBillingTime : null,
        firstSupportedAt: supportedAt,
        endedAt: status === "ENDED" ? new Date() : null,
        tierPeriods:
          status === "ACTIVE" && supportedAt
            ? { create: { tier: args.tier, startedAt: supportedAt } }
            : undefined,
      },
      select: { id: true, status: true },
    });

    return {
      id: subscription.id,
      tier: args.tier,
      status: subscription.status,
      approvalUrl: created.approvalUrl,
    };
  });
}
