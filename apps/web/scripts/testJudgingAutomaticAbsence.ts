import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  DAM_SHOW_POST_WHELP_COOLDOWN_HOURS,
  MAX_SHOW_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
} from "@showring/rules";

import { getBlockJudgingEntryDisposition } from "../server/services/judging.service";

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const scheduledEpoch = 10_000;
type EntryArg = Parameters<typeof getBlockJudgingEntryDisposition>[0];
type BlockArg = Parameters<typeof getBlockJudgingEntryDisposition>[1];

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function makeEntry(args?: {
  entry?: Partial<EntryArg>;
  dog?: Partial<EntryArg["dog"]>;
}): EntryArg {
  return {
    id: "entry-1",
    entryStatus: "ENTERED",
    breedCode2: "GS",
    kennelId: "kennel-1",
    dog: {
      id: "dog-1",
      birthEpoch: scheduledEpoch - MIN_SHOW_AGE_HOURS - 24,
      breedCode2: "GS",
      lifecycleState: "ALIVE",
      deathEpoch: null,
      ownerKennelId: "kennel-1",
      breedingAttemptsAsDam: [],
      titleProgress: null,
      healthConditionTruths: [],
      ...(args?.dog ?? {}),
    },
    ...(args?.entry ?? {}),
  } as EntryArg;
}

function makeBlock(overrides: Partial<BlockArg> = {}): BlockArg {
  return {
    id: "block-1",
    breedCode2: "GS",
    startEpoch: scheduledEpoch,
    ...overrides,
  } as BlockArg;
}

function assertIncludes(sourceText: string, needle: string, label: string) {
  assert.ok(sourceText.includes(needle), label);
}

const pregnantDisposition = getBlockJudgingEntryDisposition(
  makeEntry({
    dog: {
      breedingAttemptsAsDam: [{ status: "PREGNANT", dueEpoch: scheduledEpoch + 5, whelpedEpoch: null }],
    },
  }),
  makeBlock()
);
assert.equal(pregnantDisposition.isEligible, false, "pregnant entered bitch is excluded");
assert.equal(
  pregnantDisposition.statusToPersist,
  "ABSENT",
  "pregnant entered bitch becomes ABSENT at judging time"
);

const restingDisposition = getBlockJudgingEntryDisposition(
  makeEntry({
    dog: {
      breedingAttemptsAsDam: [
        {
          status: "WHELPED",
          dueEpoch: null,
          whelpedEpoch: scheduledEpoch - DAM_SHOW_POST_WHELP_COOLDOWN_HOURS + 1,
        },
      ],
    },
  }),
  makeBlock()
);
assert.equal(restingDisposition.isEligible, false, "post-whelp rest bitch is excluded");
assert.equal(
  restingDisposition.statusToPersist,
  "ABSENT",
  "post-whelp rest bitch becomes ABSENT at judging time"
);

const boundaryRestDisposition = getBlockJudgingEntryDisposition(
  makeEntry({
    dog: {
      breedingAttemptsAsDam: [
        {
          status: "WHELPED",
          dueEpoch: null,
          whelpedEpoch: scheduledEpoch - DAM_SHOW_POST_WHELP_COOLDOWN_HOURS,
        },
      ],
    },
  }),
  makeBlock()
);
assert.equal(
  boundaryRestDisposition.isEligible,
  true,
  "show-rest boundary at the exact scheduled epoch remains eligible"
);

const deceasedDisposition = getBlockJudgingEntryDisposition(
  makeEntry({
    dog: {
      lifecycleState: "DECEASED",
      deathEpoch: scheduledEpoch,
    },
  }),
  makeBlock()
);
assert.equal(deceasedDisposition.isEligible, false, "deceased dog is excluded");
assert.equal(
  deceasedDisposition.statusToPersist,
  "ABSENT",
  "deceased dog becomes ABSENT at judging time"
);

const overAgeDisposition = getBlockJudgingEntryDisposition(
  makeEntry({
    dog: {
      birthEpoch: scheduledEpoch - MAX_SHOW_AGE_HOURS - 1,
    },
  }),
  makeBlock()
);
assert.equal(overAgeDisposition.isEligible, false, "over-age dog is excluded");
assert.equal(
  overAgeDisposition.statusToPersist,
  "ABSENT",
  "over-age dog becomes ABSENT at judging time"
);

const underAgeDisposition = getBlockJudgingEntryDisposition(
  makeEntry({
    dog: {
      birthEpoch: scheduledEpoch - MIN_SHOW_AGE_HOURS + 1,
    },
  }),
  makeBlock()
);
assert.equal(
  underAgeDisposition.statusToPersist,
  "ABSENT",
  "historical under-age entered dogs also classify as ABSENT at judging time"
);

const ownerChangedDisposition = getBlockJudgingEntryDisposition(
  makeEntry({
    dog: {
      ownerKennelId: "kennel-2",
    },
  }),
  makeBlock()
);
assert.equal(
  ownerChangedDisposition.statusToPersist,
  "ABSENT",
  "ownership changes after entry classify as ABSENT"
);

const breedMismatchDisposition = getBlockJudgingEntryDisposition(
  makeEntry({ entry: { breedCode2: "BC" } }),
  makeBlock()
);
assert.equal(
  breedMismatchDisposition.statusToPersist,
  "INELIGIBLE",
  "breed-mismatched entries remain INELIGIBLE"
);

const alreadyAbsentDisposition = getBlockJudgingEntryDisposition(
  makeEntry({ entry: { entryStatus: "ABSENT" } }),
  makeBlock()
);
assert.equal(
  alreadyAbsentDisposition.statusToPersist,
  null,
  "existing ABSENT entries remain unchanged on repeat judging runs"
);

const eligibleDisposition = getBlockJudgingEntryDisposition(makeEntry(), makeBlock());
assert.equal(
  eligibleDisposition.isEligible,
  true,
  "otherwise eligible entered dogs remain in the judging lineup"
);

const judgingService = source("apps/web/server/services/judging.service.ts");
assertIncludes(
  judgingService,
  "statusToPersist === \"ABSENT\"",
  "judgeShowBlock classifies automatic absences separately from invalid entries"
);
assertIncludes(
  judgingService,
  'data: { entryStatus: "ABSENT" }',
  "automatic absence persists ABSENT without deleting the entry"
);
assertIncludes(
  judgingService,
  'data: { entryStatus: "INELIGIBLE" }',
  "invalid entries still persist INELIGIBLE"
);
assertIncludes(
  judgingService,
  'where: { id: { in: automaticAbsentEntryIds }, entryStatus: "ENTERED" }',
  "automatic absence updates only currently ENTERED entries for idempotency"
);
assertIncludes(
  judgingService,
  'entries: eligibleEntries.map((entry) => ({',
  "only eligible entries are sent into breed judging"
);
assertIncludes(
  judgingService,
  "if (existingResultCount > 0) {",
  "re-running judging still short-circuits to published-result repair"
);
assert.equal(
  judgingService.includes("refund"),
  false,
  "automatic absence does not introduce refund logic"
);

console.log("Judging automatic absence checks passed.");
