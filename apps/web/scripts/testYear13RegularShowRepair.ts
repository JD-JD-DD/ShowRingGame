import assert from "node:assert/strict";

import { LedgerTransactionType, ShowEntryStatus } from "@prisma/client";

import {
  buildYear13RegularShowRepairPlan,
  getExecuteAuthorizationBlockers,
  type Year13RepairClusterInput,
} from "../server/services/year13RegularShowRepair.service";
import {
  getYear13CorrectedRegularShowClusterId,
  isCorrectedYear13RegularShowClusterId,
  isLegacyYear13RegularShowClusterId,
  isYear13GeneratedRegularShowClusterId,
  isYear13RegularShowPaused,
} from "../server/services/showScheduleMigration.service";
import {
  parseAnnualShowScheduleCsv,
  validateAnnualShowScheduleRows,
  type AnnualShowScheduleRow,
} from "../../../packages/rules/src/showScheduleCsv";

function targetRow(
  overrides: Partial<AnnualShowScheduleRow> = {}
): AnnualShowScheduleRow {
  return {
    weekInYear: 1,
    slotIndex: 1,
    templateId: "week-1-slot-1",
    district: 1,
    showName: "Cascadia Four-Day Classic",
    clusterType: "FOUR_DAY",
    showDayOffsets: [4, 5, 6, 7],
    showDayNames: ["Friday", "Saturday", "Sunday", "Monday"],
    startDayOffset: 4,
    endDayOffset: 7,
    entryOpenLeadHours: 120,
    entryCloseOffsetHours: 14,
    isRegularCircuit: true,
    isInvitationalReserved: false,
    notes: "",
    ...overrides,
  };
}

function cluster(
  overrides: Partial<Year13RepairClusterInput> = {}
): Year13RepairClusterInput {
  return {
    id: "generated-year-13-week-1-slot-1",
    name: "Cascadia Four-Day Classic",
    district: 1,
    startEpoch: 4384,
    endEpoch: 4387,
    entryOpenEpoch: 4264,
    entryCloseEpoch: 4370,
    status: "OPEN",
    ledgerTransactions: [],
    primaryWeekendPlans: [],
    serviceClaims: [],
    showDays: [
      {
        id: "day-1",
        dayIndex: 1,
        scheduledEpoch: 4384,
        status: "ENTRY_OPEN",
        showEntries: [],
        _count: {
          showEntries: 0,
          showResults: 0,
          showAwards: 0,
          grandChampionCredits: 0,
          grandCompletedTitleProgresses: 0,
          prestigeCredits: 0,
        },
      },
      {
        id: "day-2",
        dayIndex: 2,
        scheduledEpoch: 4385,
        status: "ENTRY_OPEN",
        showEntries: [],
        _count: {
          showEntries: 0,
          showResults: 0,
          showAwards: 0,
          grandChampionCredits: 0,
          grandCompletedTitleProgresses: 0,
          prestigeCredits: 0,
        },
      },
      {
        id: "day-3",
        dayIndex: 3,
        scheduledEpoch: 4386,
        status: "ENTRY_OPEN",
        showEntries: [],
        _count: {
          showEntries: 0,
          showResults: 0,
          showAwards: 0,
          grandChampionCredits: 0,
          grandCompletedTitleProgresses: 0,
          prestigeCredits: 0,
        },
      },
      {
        id: "day-4",
        dayIndex: 4,
        scheduledEpoch: 4387,
        status: "ENTRY_OPEN",
        showEntries: [],
        _count: {
          showEntries: 0,
          showResults: 0,
          showAwards: 0,
          grandChampionCredits: 0,
          grandCompletedTitleProgresses: 0,
          prestigeCredits: 0,
        },
      },
    ],
    ...overrides,
  };
}

const kennel = { name: "Test Kennel", slug: "test-kennel" };
const plan = buildYear13RegularShowRepairPlan({
  targetRows: [targetRow()],
  reservedRows: [],
  pauseActive: true,
  clusters: [
    cluster({
      ledgerTransactions: [
        {
          id: "ledger-1",
          kennelId: "kennel-1",
          transactionType: LedgerTransactionType.SHOW_ENTRY_FEE,
          amount: -100,
          occurredAtEpoch: 1,
          memo: null,
          showEntryId: null,
          kennel,
        },
      ],
      primaryWeekendPlans: [
        {
          id: "plan-1",
          kennelId: "kennel-1",
          travelFeeCharged: 25,
          kennel,
        },
      ],
      showDays: [
        {
          ...cluster().showDays[0],
          showEntries: [
            {
              id: "entry-1",
              kennelId: "kennel-1",
              entryStatus: ShowEntryStatus.ENTERED,
              kennel,
            },
          ],
          _count: { ...cluster().showDays[0]._count, showEntries: 1 },
        },
      ],
    }),
  ],
});

assert.equal(plan.totals.ledgerDebitRowsToRefund, 1);
assert.equal(plan.totals.totalPositiveRefundAmount, 100);
assert.equal(plan.totals.oldContaminatedClustersToArchive, 1);
assert.equal(plan.totals.correctedReplacementClustersToCreate, 1);
assert.equal(
  plan.correctedReplacementClustersToCreate[0]?.id,
  "generated-year-13-fixed-week-1-slot-1"
);
assert.equal(plan.refundByType.SHOW_ENTRY_FEE.refundAmount, 100);
assert.equal(plan.refundByKennel[0]?.entryCount, 1);
assert.equal(plan.refundByKennel[0]?.refundAmount, 100);
assert.equal(plan.totals.weekendPlansToDelete, 1);
assert.equal(plan.repairActions.entryAction.status, ShowEntryStatus.INELIGIBLE);
assert.notEqual(plan.repairActions.entryAction.status, ShowEntryStatus.ENTERED);
assert.notEqual(plan.repairActions.entryAction.status, ShowEntryStatus.JUDGED);

assert.equal(
  getYear13CorrectedRegularShowClusterId({ weekInYear: 1, slotIndex: 1 }),
  "generated-year-13-fixed-week-1-slot-1"
);
assert.equal(
  isLegacyYear13RegularShowClusterId("generated-year-13-week-1-slot-1"),
  true
);
assert.equal(
  isLegacyYear13RegularShowClusterId("generated-year-13-fixed-week-1-slot-1"),
  false
);
assert.equal(
  isCorrectedYear13RegularShowClusterId("generated-year-13-fixed-week-1-slot-1"),
  true
);
assert.equal(
  isYear13GeneratedRegularShowClusterId("generated-year-13-fixed-week-1-slot-1"),
  true
);
assert.equal(
  isYear13RegularShowPaused({
    id: "generated-year-13-fixed-week-1-slot-1",
    year: 13,
  }),
  true
);

const competitivePlan = buildYear13RegularShowRepairPlan({
  targetRows: [targetRow()],
  reservedRows: [],
  pauseActive: true,
  clusters: [
    cluster({
      showDays: [
        {
          ...cluster().showDays[0],
          _count: { ...cluster().showDays[0]._count, showResults: 1 },
        },
      ],
    }),
  ],
});

assert.equal(competitivePlan.executeWouldBeAllowed, false);
assert.match(competitivePlan.blockers.join(" "), /Competitive-history/);

const unknownDebitPlan = buildYear13RegularShowRepairPlan({
  targetRows: [targetRow()],
  reservedRows: [],
  pauseActive: true,
  clusters: [
    cluster({
      ledgerTransactions: [
        {
          id: "ledger-unknown",
          kennelId: "kennel-1",
          transactionType: LedgerTransactionType.UPKEEP,
          amount: -5,
          occurredAtEpoch: 1,
          memo: null,
          showEntryId: null,
          kennel,
        },
      ],
    }),
  ],
});

assert.equal(unknownDebitPlan.executeWouldBeAllowed, false);
assert.match(unknownDebitPlan.blockers.join(" "), /Unsupported Year 13 ledger/);

assert.deepEqual(
  getExecuteAuthorizationBlockers({
    mode: "execute",
    confirmation: "NOPE",
    executeSecret: "a",
    jobSecret: "a",
  }),
  ["Execute mode requires --confirm=YEAR_13_REPAIR_EXECUTE."]
);
assert.deepEqual(
  getExecuteAuthorizationBlockers({
    mode: "execute",
    confirmation: "YEAR_13_REPAIR_EXECUTE",
    executeSecret: "a",
    jobSecret: "b",
  }),
  ["YEAR_13_REPAIR_EXECUTE_SECRET does not match job secret."]
);

assert.throws(() => {
  validateAnnualShowScheduleRows(
    parseAnnualShowScheduleCsv(
      "weekInYear,slotIndex,templateId,district,showName,clusterType,showDayOffsets,showDayNames,startDayOffset,endDayOffset,entryOpenLeadHours,entryCloseOffsetHours,isRegularCircuit,isInvitationalReserved,notes\n" +
        "52,1,week-52-slot-1,1,Bad Show,TWO_DAY,5|6,Saturday|Sunday,5,6,120,14,true,false,"
    )
  );
}, /Invalid annual show schedule CSV/);

console.log("Year 13 regular-show repair checks passed.");
