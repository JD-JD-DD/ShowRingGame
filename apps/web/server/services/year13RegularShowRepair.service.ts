import fs from "node:fs";
import path from "node:path";

import {
  LedgerTransactionType,
  Prisma,
  ShowClusterStatus,
  ShowDayStatus,
  ShowEntryStatus,
  ShowJudgingBlockStatus,
  type PrismaClient,
} from "@prisma/client";
import { SHOW_WEEK_HOURS, SHOW_YEAR_HOURS } from "@showring/rules";

import { db } from "../../lib/db";
import { getCurrentEpoch } from "../../lib/gameClock";
import {
  getYear13CorrectedRegularShowClusterId,
  isYear13RegularShowPaused,
  isLegacyYear13RegularShowClusterId,
} from "./showScheduleMigration.service";
import {
  parseAnnualShowScheduleCsv,
  validateAnnualShowScheduleRows,
  type AnnualShowScheduleRow,
} from "../../../../packages/rules/src/showScheduleCsv";

const YEAR_13 = 13;
const EXECUTE_CONFIRMATION = "YEAR_13_REPAIR_EXECUTE";
const ENTRY_REPAIR_STATUS: ShowEntryStatus = ShowEntryStatus.INELIGIBLE;
const REFUND_MEMO_PREFIX = "Year 13 schedule correction refund";
const ALLOWED_REFUND_SOURCE_TYPES = new Set<LedgerTransactionType>([
  LedgerTransactionType.SHOW_ENTRY_FEE,
  LedgerTransactionType.TRAVEL_COST,
  LedgerTransactionType.HANDLER_FEE,
]);
const LEGACY_YEAR_13_REGULAR_CLUSTER_ID =
  /^generated-year-13-week-(\d+)-slot-(\d+)$/;

type DbClient = PrismaClient | Prisma.TransactionClient;

type RefundSourceLedger = {
  id: string;
  kennelId: string;
  transactionType: LedgerTransactionType;
  amount: number;
  occurredAtEpoch: number;
  showClusterId: string;
};

export type Year13RepairKennelBalanceUpdate = {
  kennelId: string;
  balance: number;
  refundAmount: number;
};

export type Year13RepairPreparedRefundWrites = {
  ledgerRows: Prisma.LedgerTransactionCreateManyInput[];
  balanceUpdates: Year13RepairKennelBalanceUpdate[];
  refundedAmount: number;
};

export type Year13RepairReplacementCreateRows = {
  clusterRows: Prisma.ShowClusterCreateManyInput[];
  showDayRows: Prisma.ShowDayCreateManyInput[];
};

export type Year13RepairClusterInput = {
  id: string;
  name: string;
  district: number;
  startEpoch: number;
  endEpoch: number;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  status: string;
  ledgerTransactions: Array<{
    id: string;
    kennelId: string;
    transactionType: LedgerTransactionType;
    amount: number;
    occurredAtEpoch: number;
    memo: string | null;
    showEntryId: string | null;
    kennel: { name: string; slug: string | null };
  }>;
  primaryWeekendPlans: Array<{
    id: string;
    kennelId: string;
    travelFeeCharged: number;
    kennel: { name: string; slug: string | null };
  }>;
  serviceClaims: Array<{ id: string }>;
  showDays: Array<{
    id: string;
    dayIndex: number;
    scheduledEpoch: number;
    status: string;
    showEntries: Array<{
      id: string;
      kennelId: string;
      entryStatus: ShowEntryStatus;
      kennel: { name: string; slug: string | null };
    }>;
    _count: {
      showEntries: number;
      showResults: number;
      showAwards: number;
      grandChampionCredits: number;
      grandCompletedTitleProgresses: number;
      prestigeCredits: number;
    };
  }>;
};

export type Year13RepairSafetyCategory =
  | "EMPTY_SAFE_TO_REPLACE"
  | "FINANCIAL_ONLY"
  | "COMPETITIVE_HISTORY_PRESENT";

export type Year13RepairClusterRow = {
  id: string;
  weekInYear: number | null;
  slotIndex: number | null;
  templateId: string | null;
  expectedDistrict: number | null;
  existingDistrict: number;
  districtDiffers: boolean;
  expectedShowName: string | null;
  existingShowName: string;
  nameDiffers: boolean;
  expectedClusterType: string | null;
  existingClusterType: string;
  typeOrDayStructureDiffers: boolean;
  startEpoch: number;
  endEpoch: number;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  status: string;
  category: Year13RepairSafetyCategory;
  counts: {
    showEntries: number;
    ledgerTransactions: number;
    weekendPlans: number;
    showResults: number;
    showAwards: number;
    grandChampionCredits: number;
    grandCompletedTitleProgresses: number;
    prestigeCredits: number;
    serviceClaims: number;
  };
};

export type Year13RepairPlan = {
  csv: {
    ok: boolean;
    regularRows: number;
    reservedRows: number;
  };
  totals: {
    targetedClusterCount: number;
    csvTargetRegularClusterCount: number;
    clustersMatchingIdentity: number;
    districtDiffers: number;
    nameDiffers: number;
    typeOrDayStructureDiffers: number;
    dbClustersNotInCsvTarget: number;
    missingCsvTargetClusters: number;
    entriesToMarkIneligible: number;
    ledgerDebitRowsToRefund: number;
    weekendPlansToDelete: number;
    affectedKennels: number;
    totalPositiveRefundAmount: number;
    competitiveHistoryClusters: number;
    oldContaminatedClustersToArchive: number;
    correctedReplacementClustersToCreate: number;
  };
  refundByType: Record<string, { count: number; amount: number; refundAmount: number }>;
  refundByKennel: Array<{
    kennelId: string;
    name: string;
    slug: string | null;
    entryCount: number;
    refundAmount: number;
    ledgerCount: number;
    weekendPlanCount: number;
  }>;
  clusters: Year13RepairClusterRow[];
  missingCsvTargetClusters: Array<{
    templateId: string;
    weekInYear: number;
    slotIndex: number | null;
    district: number | null;
    showName: string;
    clusterType: string;
  }>;
  correctedReplacementClustersToCreate: Array<{
    id: string;
    templateId: string;
    weekInYear: number;
    slotIndex: number | null;
    district: number | null;
    showName: string;
    clusterType: string;
  }>;
  blockers: string[];
  executeWouldBeAllowed: boolean;
  repairActions: {
    entryAction: {
      action: "MARK_INELIGIBLE";
      status: ShowEntryStatus;
      reason: string;
    };
    weekendPlanAction: {
      action: "DELETE";
      reason: string;
    };
    ledgerAction: {
      action: "CREATE_REFUND_LEDGER_ROWS";
      transactionType: LedgerTransactionType;
      memoPrefix: string;
    };
    clusterAction: {
      recommendation: "ARCHIVE_OLD_AND_CREATE_REPLACEMENTS_WITH_DISTINCT_IDS";
      replacementIdsNeeded: boolean;
      reason: string;
    };
  };
};

function parseGeneratedYear13ClusterId(clusterId: string): {
  weekInYear: number;
  slotIndex: number;
  templateId: string;
} | null {
  const match = clusterId.match(LEGACY_YEAR_13_REGULAR_CLUSTER_ID);

  if (!match) {
    return null;
  }

  const weekInYear = Number(match[1]);
  const slotIndex = Number(match[2]);

  return {
    weekInYear,
    slotIndex,
    templateId: `week-${weekInYear}-slot-${slotIndex}`,
  };
}

function getExistingClusterType(dayCount: number): string {
  if (dayCount === 4) return "FOUR_DAY";
  if (dayCount === 2) return "TWO_DAY";
  return `DAY_COUNT_${dayCount}`;
}

function getRefundAmount(transaction: { amount: number }): number {
  return transaction.amount < 0 ? Math.abs(transaction.amount) : 0;
}

function addRefundByType(
  refundByType: Map<string, { count: number; amount: number; refundAmount: number }>,
  transaction: { transactionType: LedgerTransactionType; amount: number }
) {
  const current = refundByType.get(transaction.transactionType) ?? {
    count: 0,
    amount: 0,
    refundAmount: 0,
  };

  current.count += 1;
  current.amount += transaction.amount;
  current.refundAmount += getRefundAmount(transaction);
  refundByType.set(transaction.transactionType, current);
}

export function prepareYear13RepairRefundWrites(args: {
  debitLedgers: RefundSourceLedger[];
  kennelBalances: Map<string, number>;
  currentEpoch: number;
}): Year13RepairPreparedRefundWrites {
  const runningBalances = new Map(args.kennelBalances);
  const refundAmountsByKennel = new Map<string, number>();
  const ledgerRows: Prisma.LedgerTransactionCreateManyInput[] = [];
  let refundedAmount = 0;

  for (const refund of args.debitLedgers) {
    const currentBalance = runningBalances.get(refund.kennelId);

    if (currentBalance == null) {
      throw new Error(`Kennel ${refund.kennelId} not found for refund.`);
    }

    const refundAmount = getRefundAmount(refund);
    const nextBalance = currentBalance + refundAmount;
    runningBalances.set(refund.kennelId, nextBalance);
    refundAmountsByKennel.set(
      refund.kennelId,
      (refundAmountsByKennel.get(refund.kennelId) ?? 0) + refundAmount
    );
    refundedAmount += refundAmount;
    ledgerRows.push({
      kennelId: refund.kennelId,
      transactionType: LedgerTransactionType.REFUND,
      amount: refundAmount,
      balanceAfter: nextBalance,
      occurredAtEpoch: args.currentEpoch,
      showClusterId: refund.showClusterId,
      memo: `${REFUND_MEMO_PREFIX}: ${refund.transactionType} ${refund.showClusterId}.`,
      metadataJson: {
        sourceLedgerTransactionId: refund.id,
        sourceTransactionType: refund.transactionType,
        year: YEAR_13,
      },
    });
  }

  const balanceUpdates = [...refundAmountsByKennel.entries()]
    .map(([kennelId, refundAmount]) => ({
      kennelId,
      balance: runningBalances.get(kennelId) ?? 0,
      refundAmount,
    }))
    .sort((a, b) => a.kennelId.localeCompare(b.kennelId));

  return { ledgerRows, balanceUpdates, refundedAmount };
}

function getKennelStat(
  stats: Map<
    string,
    {
      kennelId: string;
      name: string;
      slug: string | null;
      entryCount: number;
      refundAmount: number;
      ledgerCount: number;
      weekendPlanCount: number;
    }
  >,
  kennelId: string,
  kennel: { name: string; slug: string | null }
) {
  const existing = stats.get(kennelId);

  if (existing) {
    return existing;
  }

  const created = {
    kennelId,
    name: kennel.name,
    slug: kennel.slug,
    entryCount: 0,
    refundAmount: 0,
    ledgerCount: 0,
    weekendPlanCount: 0,
  };

  stats.set(kennelId, created);
  return created;
}

export function buildYear13RegularShowRepairPlan(args: {
  targetRows: AnnualShowScheduleRow[];
  reservedRows: AnnualShowScheduleRow[];
  clusters: Year13RepairClusterInput[];
  existingCorrectedReplacementClusterIds?: Set<string>;
  pauseActive?: boolean;
}): Year13RepairPlan {
  const blockers: string[] = [];
  const targetRegularRows = args.targetRows.filter((row) => row.isRegularCircuit);
  const targetByTemplateId = new Map(
    targetRegularRows.map((row) => [row.templateId, row])
  );
  const existingTemplateIds = new Set<string>();
  const refundByType = new Map<
    string,
    { count: number; amount: number; refundAmount: number }
  >();
  const kennelStats = new Map<
    string,
    {
      kennelId: string;
      name: string;
      slug: string | null;
      entryCount: number;
      refundAmount: number;
      ledgerCount: number;
      weekendPlanCount: number;
    }
  >();
  const clusters: Year13RepairClusterRow[] = [];
  let clustersMatchingIdentity = 0;
  let districtDiffers = 0;
  let nameDiffers = 0;
  let typeOrDayStructureDiffers = 0;
  let dbClustersNotInCsvTarget = 0;
  let entriesToMarkIneligible = 0;
  let ledgerDebitRowsToRefund = 0;
  let weekendPlansToDelete = 0;
  let totalPositiveRefundAmount = 0;
  let competitiveHistoryClusters = 0;

  if (args.pauseActive === false) {
    blockers.push("Year 13 regular show pause is not active.");
  }

  for (const cluster of args.clusters) {
    const parsed = parseGeneratedYear13ClusterId(cluster.id);
    const target = parsed ? targetByTemplateId.get(parsed.templateId) : undefined;

    if (parsed) {
      existingTemplateIds.add(parsed.templateId);
    }

    const existingDayCount = cluster.showDays.length;
    const existingClusterType = getExistingClusterType(existingDayCount);
    const counts = {
      showEntries: cluster.showDays.reduce(
        (total, showDay) => total + showDay._count.showEntries,
        0
      ),
      ledgerTransactions: cluster.ledgerTransactions.length,
      weekendPlans: cluster.primaryWeekendPlans.length,
      showResults: cluster.showDays.reduce(
        (total, showDay) => total + showDay._count.showResults,
        0
      ),
      showAwards: cluster.showDays.reduce(
        (total, showDay) => total + showDay._count.showAwards,
        0
      ),
      grandChampionCredits: cluster.showDays.reduce(
        (total, showDay) => total + showDay._count.grandChampionCredits,
        0
      ),
      grandCompletedTitleProgresses: cluster.showDays.reduce(
        (total, showDay) => total + showDay._count.grandCompletedTitleProgresses,
        0
      ),
      prestigeCredits: cluster.showDays.reduce(
        (total, showDay) => total + showDay._count.prestigeCredits,
        0
      ),
      serviceClaims: cluster.serviceClaims.length,
    };
    const competitiveHistoryCount =
      counts.showResults +
      counts.showAwards +
      counts.grandChampionCredits +
      counts.grandCompletedTitleProgresses +
      counts.prestigeCredits;
    const category: Year13RepairSafetyCategory =
      competitiveHistoryCount > 0
        ? "COMPETITIVE_HISTORY_PRESENT"
        : counts.showEntries +
              counts.ledgerTransactions +
              counts.weekendPlans +
              counts.serviceClaims >
            0
          ? "FINANCIAL_ONLY"
          : "EMPTY_SAFE_TO_REPLACE";
    const clusterDistrictDiffers = Boolean(
      target && target.district !== cluster.district
    );
    const clusterNameDiffers = Boolean(target && target.showName !== cluster.name);
    const clusterStructureDiffers = Boolean(
      target &&
        (target.clusterType !== existingClusterType ||
          target.showDayOffsets.length !== existingDayCount)
    );

    if (!target) {
      dbClustersNotInCsvTarget += 1;
    }
    if (
      target &&
      !clusterDistrictDiffers &&
      !clusterNameDiffers &&
      !clusterStructureDiffers
    ) {
      clustersMatchingIdentity += 1;
    }
    if (clusterDistrictDiffers) districtDiffers += 1;
    if (clusterNameDiffers) nameDiffers += 1;
    if (clusterStructureDiffers) typeOrDayStructureDiffers += 1;
    if (competitiveHistoryCount > 0) competitiveHistoryClusters += 1;

    entriesToMarkIneligible += counts.showEntries;
    weekendPlansToDelete += counts.weekendPlans;

    for (const showDay of cluster.showDays) {
      for (const entry of showDay.showEntries) {
        const kennel = getKennelStat(kennelStats, entry.kennelId, entry.kennel);
        kennel.entryCount += 1;
      }
    }

    for (const plan of cluster.primaryWeekendPlans) {
      const kennel = getKennelStat(kennelStats, plan.kennelId, plan.kennel);
      kennel.weekendPlanCount += 1;
    }

    for (const transaction of cluster.ledgerTransactions) {
      if (
        transaction.transactionType === LedgerTransactionType.REFUND &&
        transaction.amount > 0
      ) {
        blockers.push(
          `Existing positive refund ledger ${transaction.id} found on ${cluster.id}.`
        );
        continue;
      }

      if (transaction.amount >= 0) {
        continue;
      }

      if (!ALLOWED_REFUND_SOURCE_TYPES.has(transaction.transactionType)) {
        blockers.push(
          `Unsupported Year 13 ledger debit type ${transaction.transactionType} on ${transaction.id}.`
        );
        continue;
      }

      addRefundByType(refundByType, transaction);
      ledgerDebitRowsToRefund += 1;
      totalPositiveRefundAmount += getRefundAmount(transaction);

      const kennel = getKennelStat(
        kennelStats,
        transaction.kennelId,
        transaction.kennel
      );
      kennel.ledgerCount += 1;
      kennel.refundAmount += getRefundAmount(transaction);
    }

    clusters.push({
      id: cluster.id,
      weekInYear: parsed?.weekInYear ?? null,
      slotIndex: parsed?.slotIndex ?? null,
      templateId: parsed?.templateId ?? null,
      expectedDistrict: target?.district ?? null,
      existingDistrict: cluster.district,
      districtDiffers: clusterDistrictDiffers,
      expectedShowName: target?.showName ?? null,
      existingShowName: cluster.name,
      nameDiffers: clusterNameDiffers,
      expectedClusterType: target?.clusterType ?? null,
      existingClusterType,
      typeOrDayStructureDiffers: clusterStructureDiffers,
      startEpoch: cluster.startEpoch,
      endEpoch: cluster.endEpoch,
      entryOpenEpoch: cluster.entryOpenEpoch,
      entryCloseEpoch: cluster.entryCloseEpoch,
      status: cluster.status,
      category,
      counts,
    });
  }

  const missingCsvTargetClusters = targetRegularRows
    .filter((row) => !existingTemplateIds.has(row.templateId))
    .map((row) => ({
      templateId: row.templateId,
      weekInYear: row.weekInYear,
      slotIndex: row.slotIndex,
      district: row.district,
      showName: row.showName,
      clusterType: row.clusterType,
    }));
  const correctedReplacementClustersToCreate = targetRegularRows
    .map((row) => ({
      id: getYear13CorrectedRegularShowClusterId({
        weekInYear: row.weekInYear,
        slotIndex: row.slotIndex ?? 0,
      }),
      templateId: row.templateId,
      weekInYear: row.weekInYear,
      slotIndex: row.slotIndex,
      district: row.district,
      showName: row.showName,
      clusterType: row.clusterType,
    }))
    .filter(
      (row) => !args.existingCorrectedReplacementClusterIds?.has(row.id)
    );

  if (competitiveHistoryClusters > 0) {
    blockers.push("Competitive-history state exists on targeted Year 13 clusters.");
  }

  if (args.clusters.some((cluster) => cluster.serviceClaims.length > 0)) {
    blockers.push("Service claims exist on targeted Year 13 clusters.");
  }

  if ((args.existingCorrectedReplacementClusterIds?.size ?? 0) > 0) {
    blockers.push(
      "Corrected Year 13 replacement clusters already exist; refusing to run repair again."
    );
  }

  const refundByKennel = [...kennelStats.values()].sort(
    (a, b) =>
      b.entryCount - a.entryCount ||
      b.refundAmount - a.refundAmount ||
      a.kennelId.localeCompare(b.kennelId)
  );

  return {
    csv: {
      ok: true,
      regularRows: targetRegularRows.length,
      reservedRows: args.reservedRows.length,
    },
    totals: {
      targetedClusterCount: args.clusters.length,
      csvTargetRegularClusterCount: targetRegularRows.length,
      clustersMatchingIdentity,
      districtDiffers,
      nameDiffers,
      typeOrDayStructureDiffers,
      dbClustersNotInCsvTarget,
      missingCsvTargetClusters: missingCsvTargetClusters.length,
      entriesToMarkIneligible,
      ledgerDebitRowsToRefund,
      weekendPlansToDelete,
      affectedKennels: refundByKennel.length,
      totalPositiveRefundAmount,
      competitiveHistoryClusters,
      oldContaminatedClustersToArchive: args.clusters.length,
      correctedReplacementClustersToCreate:
        correctedReplacementClustersToCreate.length,
    },
    refundByType: Object.fromEntries([...refundByType.entries()].sort()),
    refundByKennel,
    clusters,
    missingCsvTargetClusters,
    correctedReplacementClustersToCreate,
    blockers,
    executeWouldBeAllowed: blockers.length === 0,
    repairActions: {
      entryAction: {
        action: "MARK_INELIGIBLE",
        status: ENTRY_REPAIR_STATUS,
        reason:
          "ShowEntry has no CANCELLED/VOIDED status; INELIGIBLE is non-active and excluded from judging/active-entry paths.",
      },
      weekendPlanAction: {
        action: "DELETE",
        reason:
          "KennelShowWeekendPlan has no status/history field and is a temporary planning container.",
      },
      ledgerAction: {
        action: "CREATE_REFUND_LEDGER_ROWS",
        transactionType: LedgerTransactionType.REFUND,
        memoPrefix: REFUND_MEMO_PREFIX,
      },
      clusterAction: {
        recommendation: "ARCHIVE_OLD_AND_CREATE_REPLACEMENTS_WITH_DISTINCT_IDS",
        replacementIdsNeeded: true,
        reason:
          "Preserving cancelled entries on old ShowDay rows keeps audit history but blocks reuse of the same showDayId/dogId unique key for corrected re-entry.",
      },
    },
  };
}

function resolveAnnualScheduleCsvPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "docs", "annual-show-schedule.csv"),
    path.resolve(process.cwd(), "..", "..", "docs", "annual-show-schedule.csv"),
  ];
  const existingPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!existingPath) {
    throw new Error("Could not find docs/annual-show-schedule.csv.");
  }

  return existingPath;
}

function loadValidatedTargetSchedule() {
  const rows = parseAnnualShowScheduleCsv(
    fs.readFileSync(resolveAnnualScheduleCsvPath(), "utf8")
  );

  return validateAnnualShowScheduleRows(rows);
}

async function getRepairClusters(
  client: DbClient
): Promise<Year13RepairClusterInput[]> {
  return client.showCluster.findMany({
    where: {
      id: {
        startsWith: `generated-year-${YEAR_13}-week-`,
      },
    },
    orderBy: [{ startEpoch: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      district: true,
      startEpoch: true,
      endEpoch: true,
      entryOpenEpoch: true,
      entryCloseEpoch: true,
      status: true,
      ledgerTransactions: {
        select: {
          id: true,
          kennelId: true,
          transactionType: true,
          amount: true,
          occurredAtEpoch: true,
          memo: true,
          showEntryId: true,
          kennel: { select: { name: true, slug: true } },
        },
      },
      primaryWeekendPlans: {
        select: {
          id: true,
          kennelId: true,
          travelFeeCharged: true,
          kennel: { select: { name: true, slug: true } },
        },
      },
      serviceClaims: {
        select: { id: true },
      },
      showDays: {
        orderBy: [{ dayIndex: "asc" }],
        select: {
          id: true,
          dayIndex: true,
          scheduledEpoch: true,
          status: true,
          showEntries: {
            select: {
              id: true,
              kennelId: true,
              entryStatus: true,
              kennel: { select: { name: true, slug: true } },
            },
          },
          _count: {
            select: {
              showEntries: true,
              showResults: true,
              showAwards: true,
              grandChampionCredits: true,
              grandCompletedTitleProgresses: true,
              prestigeCredits: true,
            },
          },
        },
      },
    },
  });
}

async function getExistingCorrectedReplacementClusterIds(
  client: DbClient
): Promise<Set<string>> {
  const clusters = await client.showCluster.findMany({
    where: {
      id: {
        startsWith: `generated-year-${YEAR_13}-fixed-week-`,
      },
    },
    select: {
      id: true,
    },
  });

  return new Set(clusters.map((cluster) => cluster.id));
}

function getYear13WeekStartEpoch(weekInYear: number): number {
  return (YEAR_13 - 1) * SHOW_YEAR_HOURS + (weekInYear - 1) * SHOW_WEEK_HOURS;
}

export function prepareCorrectedReplacementClusterCreateRows(args: {
  targetRows: AnnualShowScheduleRow[];
  existingCorrectedReplacementClusterIds: Set<string>;
  judgeIds: string[];
}): Year13RepairReplacementCreateRows {
  if (args.judgeIds.length === 0) {
    throw new Error("Cannot create corrected Year 13 replacement shows without active judges.");
  }

  const clusterRows: Prisma.ShowClusterCreateManyInput[] = [];
  const showDayRows: Prisma.ShowDayCreateManyInput[] = [];

  for (const row of args.targetRows) {
    if (!row.isRegularCircuit || row.weekInYear === 52) {
      continue;
    }

    if (row.slotIndex == null || row.district == null) {
      throw new Error(`Invalid regular CSV row for ${row.templateId}.`);
    }

    const slotIndex = row.slotIndex;
    const clusterId = getYear13CorrectedRegularShowClusterId({
      weekInYear: row.weekInYear,
      slotIndex,
    });

    if (args.existingCorrectedReplacementClusterIds.has(clusterId)) {
      continue;
    }

    const weekStartEpoch = getYear13WeekStartEpoch(row.weekInYear);
    const startEpoch = weekStartEpoch + (row.startDayOffset ?? 0);
    const endEpoch = weekStartEpoch + (row.endDayOffset ?? 0);
    const entryOpenEpoch = Math.max(0, startEpoch - row.entryOpenLeadHours);
    const entryCloseEpoch = Math.max(0, startEpoch - row.entryCloseOffsetHours);

    clusterRows.push({
      id: clusterId,
      name: row.showName,
      year: YEAR_13,
      district: row.district,
      startEpoch,
      endEpoch,
      entryOpenEpoch,
      entryCloseEpoch,
      status: ShowClusterStatus.SCHEDULED,
    });

    for (const [dayOffsetIndex, dayOffset] of row.showDayOffsets.entries()) {
      showDayRows.push({
        clusterId,
        scheduledEpoch: weekStartEpoch + dayOffset,
        dayIndex: dayOffsetIndex + 1,
        judgeId:
          args.judgeIds[
            (row.weekInYear + slotIndex + dayOffsetIndex) % args.judgeIds.length
          ],
        status: ShowDayStatus.SCHEDULED,
      });
    }
  }

  return { clusterRows, showDayRows };
}

async function createCorrectedReplacementClusters(args: {
  client: Prisma.TransactionClient;
  targetRows: AnnualShowScheduleRow[];
  existingCorrectedReplacementClusterIds: Set<string>;
}): Promise<number> {
  const judges = await args.client.judge.findMany({
    where: { isActive: true },
    orderBy: [{ judgeCode: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  const { clusterRows, showDayRows } = prepareCorrectedReplacementClusterCreateRows({
    targetRows: args.targetRows,
    existingCorrectedReplacementClusterIds: args.existingCorrectedReplacementClusterIds,
    judgeIds: judges.map((judge) => judge.id),
  });

  if (clusterRows.length === 0) {
    return 0;
  }

  const createdClusters = await args.client.showCluster.createMany({
    data: clusterRows,
  });

  if (showDayRows.length > 0) {
    await args.client.showDay.createMany({
      data: showDayRows,
    });
  }

  return createdClusters.count;
}

export async function getYear13RegularShowRepairPlan(
  client: DbClient = db
): Promise<Year13RepairPlan> {
  const schedule = loadValidatedTargetSchedule();
  const [clusters, existingCorrectedReplacementClusterIds] = await Promise.all([
    getRepairClusters(client),
    getExistingCorrectedReplacementClusterIds(client),
  ]);

  return buildYear13RegularShowRepairPlan({
    targetRows: schedule.regularRows,
    reservedRows: schedule.reservedRows,
    clusters,
    existingCorrectedReplacementClusterIds,
    pauseActive: isYear13RegularShowPaused({
      id: "generated-year-13-week-1-slot-1",
      year: YEAR_13,
    }),
  });
}

export function getExecuteAuthorizationBlockers(args: {
  mode: "dry-run" | "execute";
  confirmation?: string;
  executeSecret?: string;
  jobSecret?: string;
}): string[] {
  if (args.mode !== "execute") {
    return [];
  }

  const blockers: string[] = [];

  if (args.confirmation !== EXECUTE_CONFIRMATION) {
    blockers.push(`Execute mode requires --confirm=${EXECUTE_CONFIRMATION}.`);
  }

  if (!args.jobSecret) {
    blockers.push("SHOWRING_JOBS_SECRET is required for execute mode.");
  }

  if (!args.executeSecret) {
    blockers.push("YEAR_13_REPAIR_EXECUTE_SECRET is required for execute mode.");
  }

  if (
    args.jobSecret &&
    args.executeSecret &&
    args.jobSecret !== args.executeSecret
  ) {
    blockers.push("YEAR_13_REPAIR_EXECUTE_SECRET does not match job secret.");
  }

  return blockers;
}

export async function executeYear13RegularShowRepair(args: {
  confirmation?: string;
  executeSecret?: string;
  jobSecret?: string;
}): Promise<{
  plan: Year13RepairPlan;
  refundedAmount: number;
  archivedClusterCount: number;
  createdReplacementClusterCount: number;
}> {
  const authBlockers = getExecuteAuthorizationBlockers({
    mode: "execute",
    confirmation: args.confirmation,
    executeSecret: args.executeSecret,
    jobSecret: args.jobSecret,
  });

  if (authBlockers.length > 0) {
    throw new Error(authBlockers.join(" "));
  }

  return db.$transaction(async (tx) => {
    const schedule = loadValidatedTargetSchedule();
    const existingCorrectedReplacementClusterIds =
      await getExistingCorrectedReplacementClusterIds(tx);
    const clusters = await getRepairClusters(tx);
    const plan = buildYear13RegularShowRepairPlan({
      targetRows: schedule.regularRows,
      reservedRows: schedule.reservedRows,
      clusters,
      existingCorrectedReplacementClusterIds,
      pauseActive: isYear13RegularShowPaused({
        id: "generated-year-13-week-1-slot-1",
        year: YEAR_13,
      }),
    });

    if (!plan.executeWouldBeAllowed) {
      throw new Error(`Execute blocked: ${plan.blockers.join(" ")}`);
    }

    if (
      clusters.some((cluster) => !isLegacyYear13RegularShowClusterId(cluster.id))
    ) {
      throw new Error("Execute target contains a non-legacy Year 13 cluster.");
    }

    const entryIds = clusters.flatMap((cluster) =>
      cluster.showDays.flatMap((showDay) =>
        showDay.showEntries
          .filter((entry) => entry.entryStatus === ShowEntryStatus.ENTERED)
          .map((entry) => entry.id)
      )
    );
    const weekendPlanIds = clusters.flatMap((cluster) =>
      cluster.primaryWeekendPlans.map((plan) => plan.id)
    );
    const debitLedgers: RefundSourceLedger[] = clusters.flatMap((cluster) =>
      cluster.ledgerTransactions
        .filter(
          (transaction) =>
            transaction.amount < 0 &&
            ALLOWED_REFUND_SOURCE_TYPES.has(transaction.transactionType)
        )
        .map((transaction) => ({
          ...transaction,
          showClusterId: cluster.id,
        }))
    ).sort(
      (a, b) =>
        a.kennelId.localeCompare(b.kennelId) ||
        a.occurredAtEpoch - b.occurredAtEpoch ||
        a.id.localeCompare(b.id)
    );

    const currentEpoch = getCurrentEpoch();
    const kennelIds = [...new Set(debitLedgers.map((ledger) => ledger.kennelId))];
    const kennels = await tx.kennel.findMany({
      where: { id: { in: kennelIds } },
      select: { id: true, balance: true },
    });
    const refundWrites = prepareYear13RepairRefundWrites({
      debitLedgers,
      kennelBalances: new Map(
        kennels.map((kennel) => [kennel.id, kennel.balance])
      ),
      currentEpoch,
    });

    if (refundWrites.ledgerRows.length > 0) {
      await tx.ledgerTransaction.createMany({
        data: refundWrites.ledgerRows,
      });
    }

    for (const update of refundWrites.balanceUpdates) {
      await tx.kennel.update({
        where: { id: update.kennelId },
        data: { balance: update.balance },
      });
    }

    if (entryIds.length > 0) {
      await tx.showEntry.updateMany({
        where: { id: { in: entryIds }, entryStatus: ShowEntryStatus.ENTERED },
        data: { entryStatus: ENTRY_REPAIR_STATUS },
      });
    }

    if (weekendPlanIds.length > 0) {
      await tx.kennelShowWeekendPlan.deleteMany({
        where: { id: { in: weekendPlanIds } },
      });
    }

    const oldClusterIds = clusters.map((cluster) => cluster.id);
    const oldShowDayIds = clusters.flatMap((cluster) =>
      cluster.showDays.map((showDay) => showDay.id)
    );

    if (oldShowDayIds.length > 0) {
      await tx.showJudgingBlock.updateMany({
        where: { showDayId: { in: oldShowDayIds } },
        data: { status: ShowJudgingBlockStatus.CANCELLED },
      });
      await tx.showDay.updateMany({
        where: { id: { in: oldShowDayIds } },
        data: { status: ShowDayStatus.CANCELLED },
      });
    }

    let archivedClusterCount = 0;

    if (oldClusterIds.length > 0) {
      const update = await tx.showCluster.updateMany({
        where: { id: { in: oldClusterIds } },
        data: { status: ShowClusterStatus.CANCELLED },
      });
      archivedClusterCount = update.count;
    }

    const createdReplacementClusterCount =
      await createCorrectedReplacementClusters({
        client: tx,
        targetRows: schedule.regularRows,
        existingCorrectedReplacementClusterIds,
      });

    return {
      plan,
      refundedAmount: refundWrites.refundedAmount,
      archivedClusterCount,
      createdReplacementClusterCount,
    };
  }, {
    maxWait: 10_000,
    timeout: 60_000,
  });
}
