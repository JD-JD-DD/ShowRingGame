// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";

import { db } from "../lib/db";
import { getCanonicalSupportSubscription } from "../server/services/supportSubscription.service";

loadEnvConfig(process.cwd());

const EXPECTED = {
  providerSubscriptionId: "I-DSPVEDWJTHFG",
  tier: "SILVER",
  paidThrough: new Date("2026-09-29T10:00:00.000Z"),
} as const;
const LIVE_CHANGE_STATES = ["PENDING_APPROVAL", "TARGET_ACTIVE_CANCELLATION_PENDING", "CLEANUP_FAILED"] as const;

function parseArguments() {
  const allowed = new Set(["--subscription-id", "--apply"]);
  for (const argument of process.argv.slice(2)) if (argument.startsWith("--") && !allowed.has(argument)) throw new Error(`Unsupported argument: ${argument}`);
  const index = process.argv.indexOf("--subscription-id");
  const subscriptionId = index === -1 ? null : process.argv[index + 1];
  if (!subscriptionId || subscriptionId.startsWith("--")) throw new Error("--subscription-id is required.");
  return { subscriptionId, apply: process.argv.includes("--apply") };
}

async function preflight(database: any, subscriptionId: string) {
  const subscription = await database.supportSubscription.findUnique({ where: { id: subscriptionId }, include: { tierPeriods: { where: { endedAt: null } } } });
  if (!subscription) throw new Error("Preflight failed: exact support subscription was not found.");
  if (subscription.providerSubscriptionId !== EXPECTED.providerSubscriptionId || subscription.currentTier !== EXPECTED.tier || subscription.status !== "ENDED") throw new Error("Preflight failed: subscription does not match the permitted ended Silver cancellation record.");
  if (subscription.cancellationRequestedAt || !subscription.endedAt || !subscription.currentPaidPeriodEnd || subscription.currentPaidPeriodEnd.getTime() !== EXPECTED.paidThrough.getTime() || subscription.currentPaidPeriodEnd <= new Date()) throw new Error("Preflight failed: paid-through cancellation state does not match the permitted repair contract.");
  if (subscription.tierPeriods.length !== 1 || subscription.tierPeriods[0].tier !== "SILVER") throw new Error("Preflight failed: the Silver entitlement tier period is not open.");
  const [liveChangeCount, competingCurrentCount] = await Promise.all([
    database.supportSubscriptionChange.count({ where: { userId: subscription.userId, status: { in: LIVE_CHANGE_STATES } } }),
    database.supportSubscription.count({ where: { userId: subscription.userId, provider: "PAYPAL", status: { in: ["PENDING", "ACTIVE", "PAYMENT_RETRY", "CANCELLATION_SCHEDULED"] } } }),
  ]);
  if (liveChangeCount !== 0 || competingCurrentCount !== 0) throw new Error("Preflight failed: the account has a live workflow or competing current support subscription.");
  return subscription;
}

async function verify(subscriptionId: string) {
  const subscription = await db.supportSubscription.findUnique({ where: { id: subscriptionId }, include: { tierPeriods: { where: { endedAt: null } } } });
  if (!subscription) throw new Error("Verification failed: support subscription is missing.");
  const canonical = await getCanonicalSupportSubscription({ userId: subscription.userId, database: db });
  return {
    subscription: { status: subscription.status, cancellationRequestedAt: subscription.cancellationRequestedAt, endedAt: subscription.endedAt, currentPaidPeriodEnd: subscription.currentPaidPeriodEnd, currentTier: subscription.currentTier, openTierPeriods: subscription.tierPeriods.map((period: any) => ({ tier: period.tier, startedAt: period.startedAt })) },
    presentation: { canonical: canonical?.id === subscription.id, supporterBadgeEligible: subscription.status === "CANCELLATION_SCHEDULED", normalManagementControlsEligible: subscription.status === "ACTIVE" },
  };
}

async function main() {
  const args = parseArguments();
  const before = await preflight(db, args.subscriptionId);
  if (args.apply) {
    await db.$transaction(async (tx) => {
      const checked = await preflight(tx, args.subscriptionId);
      await tx.supportSubscription.update({ where: { id: checked.id }, data: { status: "CANCELLATION_SCHEDULED", cancellationRequestedAt: new Date(), endedAt: null } });
    });
  }
  console.log(JSON.stringify({ mode: args.apply ? "APPLY" : "DRY_RUN", preflight: { subscriptionId: before.id, providerSubscriptionId: before.providerSubscriptionId, paidThrough: before.currentPaidPeriodEnd }, verification: await verify(args.subscriptionId) }, null, 2));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Support cancellation paid-through repair failed."); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); });
