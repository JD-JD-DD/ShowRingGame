import { strict as assert } from "node:assert";

import {
  buildShowCountdowns,
  type BuildShowCountdownsInput,
} from "../lib/showCountdowns";

const currentEpoch = 1_000;

function buildInput(
  overrides: Partial<BuildShowCountdownsInput> = {}
): BuildShowCountdownsInput {
  return {
    currentEpoch,
    clusterId: "cluster-1",
    clusterStatus: "SCHEDULED",
    displayStatus: "SCHEDULED",
    entryOpenEpoch: currentEpoch + 10,
    entryCloseEpoch: currentEpoch + 48,
    startEpoch: currentEpoch + 120,
    resultCount: 0,
    hasJudgingActivity: false,
    showDays: [
      {
        scheduledEpoch: currentEpoch + 120,
        status: "SCHEDULED",
        publishedAtEpoch: null,
        resultCount: 0,
      },
    ],
    ...overrides,
  };
}

const scheduled = buildShowCountdowns(buildInput());

assert.equal(
  scheduled.entryClose.value,
  "Entries open in 10h.",
  "scheduled shows count down to entry opening"
);
assert.equal(
  scheduled.entryClose.shortValue,
  "opens in 10h",
  "scheduled entry short copy is suitable for Show Clock lists"
);
assert.equal(
  scheduled.entryClose.targetEpoch,
  currentEpoch + 10,
  "scheduled entry card targets entry open"
);
assert.equal(
  scheduled.rowMetaLabel,
  "Entries open in 10h",
  "scheduled row meta stays compact"
);

const open = buildShowCountdowns(
  buildInput({
    clusterStatus: "OPEN",
    displayStatus: "OPEN",
    entryOpenEpoch: currentEpoch - 1,
  })
);

assert.equal(
  open.entryClose.value,
  "Entries close in 2d.",
  "open shows count down to entry closing"
);
assert.equal(
  open.entryClose.shortValue,
  "closes in 2d",
  "open entry short copy is suitable for Show Clock lists"
);
assert.equal(
  open.judging.value,
  "Judging starts in 5d.",
  "open shows can also expose judging countdown"
);
assert.equal(
  open.judging.shortValue,
  "judges in 5d",
  "open judging short copy is suitable for Show Clock lists"
);
assert.equal(
  open.rowMetaLabel,
  "Entries close in 2d · Judges in 5d",
  "open row meta includes entry close and judging countdowns"
);

const closed = buildShowCountdowns(
  buildInput({
    clusterStatus: "CLOSED",
    displayStatus: "CLOSED",
    entryOpenEpoch: currentEpoch - 100,
    entryCloseEpoch: currentEpoch - 1,
  })
);

assert.equal(
  closed.entryClose.value,
  "Entries closed.",
  "closed shows do not show stale entry countdowns"
);
assert.equal(
  closed.judging.value,
  "Judging starts in 5d.",
  "closed shows before judging count down to judging"
);
assert.equal(
  closed.rowMetaLabel,
  "Entries closed · Judges in 5d",
  "closed row meta includes closed entries and upcoming judging"
);

const awaitingJudging = buildShowCountdowns(
  buildInput({
    clusterStatus: "CLOSED",
    displayStatus: "AWAITING JUDGING",
    entryOpenEpoch: currentEpoch - 100,
    entryCloseEpoch: currentEpoch - 10,
    startEpoch: currentEpoch - 1,
    showDays: [
      {
        scheduledEpoch: currentEpoch - 1,
        status: "CLOSED",
        publishedAtEpoch: null,
        resultCount: 0,
      },
    ],
  })
);

assert.equal(
  awaitingJudging.judging.value,
  "Awaiting judging.",
  "awaiting judging status gets status-aware copy"
);
assert.equal(
  awaitingJudging.rowMetaLabel,
  "Awaiting judging",
  "awaiting judging row meta is compact"
);

const judging = buildShowCountdowns(
  buildInput({
    clusterStatus: "JUDGING",
    displayStatus: "JUDGING",
    entryOpenEpoch: currentEpoch - 100,
    entryCloseEpoch: currentEpoch - 10,
    startEpoch: currentEpoch - 1,
    hasJudgingActivity: true,
    showDays: [
      {
        scheduledEpoch: currentEpoch - 1,
        status: "JUDGING",
        publishedAtEpoch: null,
        resultCount: 0,
      },
    ],
  })
);

assert.equal(
  judging.entryClose.value,
  "Entries locked.",
  "judging shows lock entry wording"
);
assert.equal(
  judging.judging.value,
  "Judging now.",
  "judging shows use underway wording"
);
assert.equal(
  judging.rowMetaLabel,
  "Judging now",
  "judging row meta is compact"
);

const judged = buildShowCountdowns(
  buildInput({
    clusterStatus: "COMPLETE",
    displayStatus: "JUDGED",
    entryOpenEpoch: currentEpoch - 100,
    entryCloseEpoch: currentEpoch - 10,
    startEpoch: currentEpoch - 1,
    resultCount: 3,
    showDays: [
      {
        scheduledEpoch: currentEpoch - 1,
        status: "RESULTS_PUBLISHED",
        publishedAtEpoch: currentEpoch - 1,
        resultCount: 3,
      },
    ],
  })
);

assert.equal(
  judged.entryClose.value,
  "Results available.",
  "judged shows do not show entry countdowns"
);
assert.equal(
  judged.judging.value,
  "Results available.",
  "judged shows use published judging copy"
);
assert.equal(
  judged.rowMetaLabel,
  "Results available",
  "judged row meta is compact"
);

const cancelled = buildShowCountdowns(
  buildInput({
    clusterStatus: "CANCELLED",
    displayStatus: "CANCELLED",
  })
);

assert.equal(
  cancelled.entryClose.value,
  "Show cancelled.",
  "cancelled shows suppress entry countdowns"
);
assert.equal(
  cancelled.judging.value,
  "Show cancelled.",
  "cancelled shows suppress judging countdowns"
);
assert.equal(
  cancelled.rowMetaLabel,
  "Cancelled",
  "cancelled row meta is compact"
);

console.log("Show countdown checks passed.");
