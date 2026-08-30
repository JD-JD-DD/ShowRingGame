// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";

import { db } from "../lib/db";
import { getCanonicalSupportSubscription } from "../server/services/supportSubscription.service";

loadEnvConfig(process.cwd());

const LIVE_STATES = ["PENDING_APPROVAL", "TARGET_ACTIVE_CANCELLATION_PENDING", "CLEANUP_FAILED"] as const;
const EXPECTED = {
  sourceProviderSubscriptionId: "I-9YLC9RKLTJSR",
  targetProviderSubscriptionId: "I-DSPVEDWJTHFG",
  sourceTier: "BRONZE",
  targetTier: "SILVER",
} as const;

type Arguments = { sourceId: string; targetId: string; changeId: string; apply: boolean };

function argumentValue(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? null : process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} is required.`);
  return value;
}

function parseArguments(): Arguments {
  const allowed = new Set(["--source-subscription-id", "--target-subscription-id", "--change-id", "--apply"]);
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith("--") && !allowed.has(argument)) throw new Error(`Unsupported argument: ${argument}`);
  }
  return {
    sourceId: argumentValue("--source-subscription-id"),
    targetId: argumentValue("--target-subscription-id"),
    changeId: argumentValue("--change-id"),
    apply: process.argv.includes("--apply"),
  };
}

async function preflight(database: any, args: Arguments) {
  const [source, target, change] = await Promise.all([
    database.supportSubscription.findUnique({ where: { id: args.sourceId }, include: { tierPeriods: { where: { endedAt: null } } } }),
    database.supportSubscription.findUnique({ where: { id: args.targetId } }),
    database.supportSubscriptionChange.findUnique({ where: { id: args.changeId } }),
  ]);
  if (!source || !target || !change) throw new Error("Preflight failed: an exact repair record was not found.");
  if (source.providerSubscriptionId !== EXPECTED.sourceProviderSubscriptionId || source.currentTier !== EXPECTED.sourceTier || source.status !== "ACTIVE") throw new Error("Preflight failed: source does not match the permitted stale Bronze record.");
  if (target.providerSubscriptionId !== EXPECTED.targetProviderSubscriptionId || target.currentTier !== EXPECTED.targetTier || target.status !== "ACTIVE") throw new Error("Preflight failed: target does not match the permitted active Silver record.");
  if (change.type !== "UPGRADE" || change.status !== "CLEANUP_FAILED" || change.sourceSupportSubscriptionId !== source.id || change.targetSupportSubscriptionId !== target.id || !change.targetActivatedAt || change.completedAt) throw new Error("Preflight failed: workflow does not match the permitted failed upgrade cleanup.");
  if (source.userId !== target.userId || source.userId !== change.userId) throw new Error("Preflight failed: repair records do not belong to one account.");
  const canonical = await getCanonicalSupportSubscription({ userId: source.userId, database });
  if (!canonical || canonical.id !== target.id || canonical.status !== "ACTIVE") throw new Error("Preflight failed: target is not the active canonical subscription.");
  const otherLiveChanges = await database.supportSubscriptionChange.count({ where: { userId: source.userId, status: { in: LIVE_STATES }, id: { not: change.id } } });
  if (otherLiveChanges !== 0) throw new Error("Preflight failed: another live support change exists for this account.");
  return { source, target, change, canonical, otherLiveChanges };
}

async function verification(database: any, args: Arguments) {
  const [source, target, change] = await Promise.all([
    database.supportSubscription.findUnique({ where: { id: args.sourceId }, include: { tierPeriods: { where: { endedAt: null } } } }),
    database.supportSubscription.findUnique({ where: { id: args.targetId } }),
    database.supportSubscriptionChange.findUnique({ where: { id: args.changeId } }),
  ]);
  if (!source || !target || !change) throw new Error("Verification failed: a repair record is missing.");
  const canonical = await getCanonicalSupportSubscription({ userId: target.userId, database });
  const liveChangeCount = await database.supportSubscriptionChange.count({ where: { userId: target.userId, status: { in: LIVE_STATES } } });
  return {
    bronze: { status: source.status, endedAt: source.endedAt, openTierPeriods: source.tierPeriods.length },
    silver: { status: target.status, canonical: canonical?.id === target.id },
    workflow: { status: change.status, completedAt: change.completedAt },
    account: { liveSupportSubscriptionChangeCount: liveChangeCount, normalCancellationEligible: target.status === "ACTIVE" && canonical?.id === target.id && liveChangeCount === 0 },
  };
}

async function main() {
  const args = parseArguments();
  const before = await preflight(db, args);
  if (args.apply) {
    await db.$transaction(async (tx) => {
      const checked = await preflight(tx, args);
      const terminalAt = checked.source.endedAt ?? new Date();
      for (const period of checked.source.tierPeriods) {
        await tx.supportSubscriptionTierPeriod.update({ where: { id: period.id }, data: { endedAt: checked.change.targetActivatedAt } });
      }
      await tx.supportSubscription.update({ where: { id: checked.source.id }, data: { status: "ENDED", endedAt: terminalAt } });
      await tx.supportSubscriptionChange.update({ where: { id: checked.change.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    });
  }
  console.log(JSON.stringify({ mode: args.apply ? "APPLY" : "DRY_RUN", preflight: { sourceId: before.source.id, targetId: before.target.id, changeId: before.change.id, targetCanonical: before.canonical.id === before.target.id }, verification: await verification(db, args) }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Support upgrade cleanup repair failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
