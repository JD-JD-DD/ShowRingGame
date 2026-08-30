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

export type SupportSubscriptionChangeState =
  | "PENDING_APPROVAL"
  | "TARGET_ACTIVE_CANCELLATION_PENDING"
  | "COMPLETED"
  | "ABANDONED"
  | "CLEANUP_FAILED";

const LIVE_CHANGE_STATES: SupportSubscriptionChangeState[] = [
  "PENDING_APPROVAL",
  "TARGET_ACTIVE_CANCELLATION_PENDING",
  "CLEANUP_FAILED",
];

type CanonicalSubscription = {
  id: string;
  userId: string;
  providerSubscriptionId: string;
  currentTier: SupportTierValue;
  status: CanonicalSupportStatus;
  firstSupportedAt?: Date | null;
  currentPaidPeriodStart?: Date | null;
  currentPaidPeriodEnd?: Date | null;
};

/**
 * Chooses a player's recognised subscription. A replacement only takes over
 * after its provider-backed row is ACTIVE; timestamps and query order are never
 * used to break an upgrade overlap.
 */
export async function getCanonicalSupportSubscription(args: {
  userId: string;
  database?: any;
}): Promise<CanonicalSubscription | null> {
  const database = args.database ?? db;
  const change = await database.supportSubscriptionChange?.findFirst?.({
    where: { userId: args.userId, status: { in: LIVE_CHANGE_STATES } },
    orderBy: { requestedAt: "desc" },
    include: { sourceSubscription: true, targetSubscription: true },
  });
  if (change) {
    if (change.targetActivatedAt && change.targetSubscription?.status === "ACTIVE") return change.targetSubscription;
    return change.sourceSubscription;
  }
  const current = database.supportSubscription.findMany
    ? await database.supportSubscription.findMany({ where: { userId: args.userId, provider: "PAYPAL", status: { in: CURRENT_SUPPORT_STATUSES } } })
    : await database.supportSubscription.findFirst({ where: { userId: args.userId, provider: "PAYPAL", status: { in: CURRENT_SUPPORT_STATUSES } } }).then((value: any) => value ? [value] : []);
  return current.length === 1 ? current[0] : null;
}

function isStrictUpgrade(source: SupportTierValue, target: SupportTierValue): boolean {
  return ({ BRONZE: 0, SILVER: 1, GOLD: 2 } as const)[target] > ({ BRONZE: 0, SILVER: 1, GOLD: 2 } as const)[source];
}

export type CreateSupportSubscriptionChangeResult = {
  tier: SupportTierValue;
  status: SupportSubscriptionChangeState;
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
  const inProgressChange = await database.supportSubscriptionChange?.findFirst?.({
    where: { userId: args.userId, status: { in: LIVE_CHANGE_STATES } },
    include: { targetSubscription: true },
  });
  if (inProgressChange?.targetSubscription && !inProgressChange.targetActivatedAt) {
    const targetProviderSubscription = await (args.payPalClient ?? createPayPalClient()).getSubscription(inProgressChange.targetSubscription.providerSubscriptionId);
    const targetStatus = verifyPayPalSubscription({ subscription: targetProviderSubscription, tier: inProgressChange.targetTier, config: args.config });
    await synchronizeVerifiedPayPalSubscription({ database, providerSubscription: targetProviderSubscription, tier: inProgressChange.targetTier, status: targetStatus, skipUnchanged: true });
    await advanceSupportSubscriptionChange({ database, payPalClient: args.payPalClient, targetProviderSubscriptionId: inProgressChange.targetSubscription.providerSubscriptionId });
  }
  const subscription = await getCanonicalSupportSubscription({ userId: args.userId, database });
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
  await advanceSupportSubscriptionChange({ database, payPalClient: args.payPalClient, targetProviderSubscriptionId: subscription.providerSubscriptionId });
  if (!result) throw new SupportSubscriptionError("No current PayPal support subscription was found.", 404);
  return result;
}

/** Promotes an already verified replacement and performs its exact-source cleanup. */
export async function advanceSupportSubscriptionChange(args: {
  database?: any;
  payPalClient?: PayPalClient;
  targetProviderSubscriptionId: string;
}): Promise<void> {
  const database = args.database ?? db;
  const client = args.payPalClient ?? createPayPalClient();
  const change = await database.supportSubscriptionChange?.findFirst?.({
    where: { targetSubscription: { providerSubscriptionId: args.targetProviderSubscriptionId }, status: { in: LIVE_CHANGE_STATES } },
    include: { sourceSubscription: { include: { tierPeriods: { where: { endedAt: null } } } }, targetSubscription: true },
  });
  if (!change || !change.targetSubscription) return;
  if (change.targetSubscription.status !== "ACTIVE") {
    if (["ENDED"].includes(change.targetSubscription.status) && change.status === "PENDING_APPROVAL") {
      await database.supportSubscriptionChange.update({ where: { id: change.id }, data: { status: "ABANDONED", abandonedAt: new Date() } });
    }
    return;
  }
  const activatedAt = change.targetSubscription.currentPaidPeriodStart ?? new Date();
  if (!change.targetActivatedAt) {
    await database.$transaction(async (tx: any) => {
      const fresh = await tx.supportSubscriptionChange.findUnique({ where: { id: change.id }, include: { sourceSubscription: { include: { tierPeriods: { where: { endedAt: null } } } } } });
      if (!fresh || fresh.targetActivatedAt) return;
      for (const period of fresh.sourceSubscription.tierPeriods) {
        await tx.supportSubscriptionTierPeriod.update({ where: { id: period.id }, data: { endedAt: activatedAt } });
      }
      await tx.supportSubscriptionChange.update({ where: { id: fresh.id }, data: { status: "TARGET_ACTIVE_CANCELLATION_PENDING", targetActivatedAt: activatedAt } });
    });
  }
  try {
    await database.supportSubscriptionChange.update({ where: { id: change.id }, data: { status: "TARGET_ACTIVE_CANCELLATION_PENDING", sourceCancellationRequestedAt: new Date(), failedAt: null } });
    await client.cancelSubscription(change.sourceSubscription.providerSubscriptionId);
    const source = await client.getSubscription(change.sourceSubscription.providerSubscriptionId);
    const sourceStatus = verifyPayPalSubscription({ subscription: source, tier: change.sourceSubscription.currentTier });
    await synchronizeVerifiedPayPalSubscription({ database, providerSubscription: source, tier: change.sourceSubscription.currentTier, status: sourceStatus });
    if (sourceStatus === "ENDED") {
      await database.supportSubscriptionChange.update({ where: { id: change.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    }
  } catch {
    await database.supportSubscriptionChange.update({ where: { id: change.id }, data: { status: "CLEANUP_FAILED", failedAt: new Date() } });
  }
}

export async function createPayPalSupportSubscriptionChange(args: {
  userId: string;
  tier: SupportTierValue;
  returnUrl: string;
  cancelUrl: string;
  database?: any;
  payPalClient?: PayPalClient;
}): Promise<CreateSupportSubscriptionChangeResult> {
  const database = args.database ?? db;
  const client = args.payPalClient ?? createPayPalClient();
  return database.$transaction(async (tx: any) => {
    const users = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "id" = ${args.userId} FOR UPDATE`;
    if (users.length !== 1) throw new SupportSubscriptionError("Account not found.", 404);
    const canonical = await getCanonicalSupportSubscription({ userId: args.userId, database: tx });
    if (!canonical || canonical.status !== "ACTIVE") throw new SupportSubscriptionError("You can only upgrade from an active support subscription.", 409);
    if (canonical.currentTier === args.tier) throw new SupportSubscriptionError(`${args.tier[0]}${args.tier.slice(1).toLowerCase()} Supporter is already your current support level.`, 409);
    if (!isStrictUpgrade(canonical.currentTier, args.tier)) throw new SupportSubscriptionError("Support levels can only be upgraded right now.", 409);

    const existing = await tx.supportSubscriptionChange.findFirst({
      where: { userId: args.userId, status: { in: LIVE_CHANGE_STATES } },
      include: { targetSubscription: true },
    });
    if (existing) {
      if (existing.status === "PENDING_APPROVAL" && existing.targetTier === args.tier && existing.targetSubscription?.status === "PENDING") {
        const provider = await client.getSubscription(existing.targetSubscription.providerSubscriptionId);
        if (provider.status === "APPROVAL_PENDING") {
          return { tier: args.tier, status: "PENDING_APPROVAL", approvalUrl: existing.approvalUrl };
        }
        await tx.supportSubscriptionChange.update({ where: { id: existing.id }, data: { status: "ABANDONED", abandonedAt: new Date() } });
      } else {
        throw new SupportSubscriptionError("A support-level change is already in progress.", 409);
      }
    }

    const change = await tx.supportSubscriptionChange.create({ data: {
      userId: args.userId, sourceSupportSubscriptionId: canonical.id, targetTier: args.tier, status: "PENDING_APPROVAL",
    } });
    const created = await client.createSubscription({ tier: args.tier, returnUrl: args.returnUrl, cancelUrl: args.cancelUrl });
    const verified = await client.getSubscription(created.providerSubscriptionId);
    const status = verifyPayPalSubscription({ subscription: verified, tier: args.tier });
    if (status === "ENDED") {
      await tx.supportSubscriptionChange.update({ where: { id: change.id }, data: { status: "ABANDONED", abandonedAt: new Date() } });
      throw new SupportSubscriptionError("PayPal could not start this support-level change.", 422);
    }
    const target = await tx.supportSubscription.create({ data: {
      userId: args.userId, provider: "PAYPAL", providerSubscriptionId: verified.id, currentTier: args.tier, status,
      currentPaidPeriodStart: status === "ACTIVE" ? verified.startTime ?? new Date() : null,
      currentPaidPeriodEnd: status === "ACTIVE" ? verified.nextBillingTime : null,
      firstSupportedAt: canonical.firstSupportedAt ?? canonical.currentPaidPeriodStart ?? new Date(),
      tierPeriods: status === "ACTIVE" ? { create: { tier: args.tier, startedAt: verified.startTime ?? new Date() } } : undefined,
    }, select: { id: true } });
    await tx.supportSubscriptionChange.update({ where: { id: change.id }, data: { targetSupportSubscriptionId: target.id, approvalUrl: created.approvalUrl } });
    return { tier: args.tier, status: "PENDING_APPROVAL", approvalUrl: created.approvalUrl };
  });
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
