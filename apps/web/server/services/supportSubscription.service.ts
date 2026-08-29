import { db } from "@/lib/db";
import {
  createPayPalClient,
  getPayPalPlanId,
  getPayPalSupportConfig,
  type PayPalClient,
  type PayPalSupportConfig,
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

type SupportSynchronizationDatabase = {
  $transaction<T>(callback: (transaction: any) => Promise<T>): Promise<T>;
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
  config?: PayPalSupportConfig;
}): CanonicalSupportStatus {
  const config = args.config ?? getPayPalSupportConfig();
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

function sameDate(left: Date | null | undefined, right: Date | null | undefined): boolean {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

export async function synchronizeVerifiedPayPalSubscription(args: {
  database: SupportSynchronizationDatabase;
  providerSubscription: PayPalSupportSubscription;
  tier: SupportTierValue;
  status: CanonicalSupportStatus;
  skipUnchanged?: boolean;
}): Promise<{ tier: SupportTierValue; status: CanonicalSupportStatus } | null> {
  const now = new Date();
  return args.database.$transaction(async (tx) => {
    const subscription = await tx.supportSubscription.findUnique({
      where: { providerSubscriptionId: args.providerSubscription.id },
    });
    if (!subscription) return null;

    await tx.$queryRaw`SELECT "id" FROM "SupportSubscription" WHERE "id" = ${subscription.id} FOR UPDATE`;
    const fresh = await tx.supportSubscription.findUnique({
      where: { id: subscription.id },
      include: { tierPeriods: { where: { endedAt: null } } },
    });
    const startedAt = args.providerSubscription.startTime ?? now;
    const activePeriod = fresh.tierPeriods[0];
    const hasSupported = args.status !== "PENDING";
    const currentPaidPeriodStart = args.status === "ACTIVE" ? startedAt : fresh.currentPaidPeriodStart;
    const currentPaidPeriodEnd = args.status === "ACTIVE" ? args.providerSubscription.nextBillingTime : fresh.currentPaidPeriodEnd;
    const firstSupportedAt = fresh.firstSupportedAt ?? (args.status === "ACTIVE" ? startedAt : null);
    const cancellationRequestedAt = args.status === "CANCELLATION_SCHEDULED" ? fresh.cancellationRequestedAt ?? now : null;
    const endedAt = args.status === "ENDED" ? fresh.endedAt ?? now : null;
    const tierPeriodChanges = hasSupported && (!activePeriod || activePeriod.tier !== args.tier);

    if (hasSupported && activePeriod && activePeriod.tier !== args.tier) {
      await tx.supportSubscriptionTierPeriod.update({ where: { id: activePeriod.id }, data: { endedAt: startedAt } });
    }
    if (tierPeriodChanges) {
      await tx.supportSubscriptionTierPeriod.create({ data: { supportSubscriptionId: fresh.id, tier: args.tier, startedAt } });
    }

    const unchanged =
      fresh.currentTier === args.tier &&
      fresh.status === args.status &&
      sameDate(fresh.currentPaidPeriodStart, currentPaidPeriodStart) &&
      sameDate(fresh.currentPaidPeriodEnd, currentPaidPeriodEnd) &&
      sameDate(fresh.firstSupportedAt, firstSupportedAt) &&
      sameDate(fresh.cancellationRequestedAt, cancellationRequestedAt) &&
      sameDate(fresh.endedAt, endedAt);
    if (!args.skipUnchanged || !unchanged) {
      await tx.supportSubscription.update({ where: { id: fresh.id }, data: {
        currentTier: args.tier,
        status: args.status,
        currentPaidPeriodStart,
        currentPaidPeriodEnd,
        firstSupportedAt,
        cancellationRequestedAt,
        endedAt,
      } });
    }
    return { tier: args.tier, status: args.status };
  });
}

export async function reconcilePayPalSupportSubscription(args: {
  userId: string;
  database?: any;
  payPalClient?: PayPalClient;
  config?: PayPalSupportConfig;
}): Promise<{ tier: SupportTierValue; status: CanonicalSupportStatus }> {
  const database = args.database ?? db;
  const subscription = await database.supportSubscription.findFirst({
    where: { userId: args.userId, provider: "PAYPAL", status: { in: CURRENT_SUPPORT_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: { currentTier: true, providerSubscriptionId: true },
  });
  if (!subscription) throw new SupportSubscriptionError("No current PayPal support subscription was found.", 404);

  const providerSubscription = await (args.payPalClient ?? createPayPalClient()).getSubscription(subscription.providerSubscriptionId);
  if (providerSubscription.id !== subscription.providerSubscriptionId) {
    throw new SupportSubscriptionError("PayPal support status could not be verified.", 422);
  }
  const status = verifyPayPalSubscription({
    subscription: providerSubscription,
    tier: subscription.currentTier,
    config: args.config,
  });
  const result = await synchronizeVerifiedPayPalSubscription({
    database,
    providerSubscription,
    tier: subscription.currentTier,
    status,
    skipUnchanged: true,
  });
  if (!result) throw new SupportSubscriptionError("No current PayPal support subscription was found.", 404);
  return result;
}

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
