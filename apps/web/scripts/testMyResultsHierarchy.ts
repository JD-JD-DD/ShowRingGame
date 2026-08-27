import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildMyResultsHierarchy,
  type MyResultsQueryEntry,
} from "../app/my-results/myResults.loader";

const root = process.cwd().endsWith(join("apps", "web")) ? process.cwd() : join(process.cwd(), "apps", "web");

function entry(overrides: Partial<MyResultsQueryEntry> = {}): MyResultsQueryEntry {
  const base: MyResultsQueryEntry = {
    id: "entry-labrador-day-2",
    entryStatus: "JUDGED",
    absenceReason: null,
    dog: { id: "dog-labrador", callName: "Lab", registeredName: "Alpha Labrador", regNumber: "LAB-1", visibleTitlePrefix: null, visibleTitleSuffix: null },
    breed: { code2: "LAB", name: "Labrador Retriever", groupName: "Sporting" },
    judgingBlock: { judge: { name: "Block Judge", judgeCode: "BLOCK" } },
    showDay: {
      id: "day-2",
      dayIndex: 2,
      scheduledEpoch: 200,
      judge: { name: "BIS Judge", judgeCode: "BIS" },
      cluster: { id: "cluster-1", name: "Test Cluster", district: 1 },
      groupJudgeAssignments: [{ groupCode: "SPORTING", judge: { name: "Scheduled Judge", judgeCode: "SCHEDULED" } }],
    },
    showResult: {
      pointsAwarded: 4,
      isMajor: true,
      judge: { name: "Result Judge", judgeCode: "RESULT" },
      showAwards: [{ awardCode: "WD", grandChampionCredit: { pointsAwarded: 3, isMajor: true } }],
    },
  };

  return { ...base, ...overrides };
}

const toy = entry({
  id: "entry-toy-day-2",
  dog: { id: "dog-toy", callName: "Toy", registeredName: "Beta Toy", regNumber: "TOY-1", visibleTitlePrefix: null, visibleTitleSuffix: null },
  breed: { code2: "POOD", name: "Toy Poodle", groupName: "Toy" },
  showDay: {
    ...entry().showDay,
    groupJudgeAssignments: [{ groupCode: "TOY", judge: { name: "Toy Scheduled", judgeCode: "TOY-SCHEDULED" } }],
  },
});
const dayOneLabrador = entry({
  id: "entry-labrador-day-1",
  showDay: { ...entry().showDay, id: "day-1", dayIndex: 1, scheduledEpoch: 100 },
  showResult: null,
  judgingBlock: null,
  entryStatus: "ABSENT",
  absenceReason: "LIFECYCLE_UNAVAILABLE",
});
const blockFallback = entry({ id: "entry-block", showResult: null });
const scheduledFallback = entry({ id: "entry-scheduled", showResult: null, judgingBlock: null });
const unmapped = entry({
  id: "entry-unmapped",
  breed: { code2: "LEGACY", name: "Legacy Breed", groupName: "Legacy Group" },
  showResult: null,
  judgingBlock: null,
});

const hierarchy = buildMyResultsHierarchy([toy, dayOneLabrador, entry(), blockFallback, scheduledFallback, unmapped]);
assert.equal(hierarchy.length, 1);
assert.deepEqual(hierarchy[0].showDays.map((day) => day.id), ["day-1", "day-2"]);
assert.deepEqual(hierarchy[0].showDays[1].groups.map((group) => group.code), ["SPORTING", "TOY", "UNMAPPED"]);
assert.equal(hierarchy[0].showDays[1].groups[0].breeds[0].name, "Labrador Retriever");
assert.equal(hierarchy[0].showDays[1].groups[1].breeds[0].name, "Toy Poodle");
assert.equal(hierarchy[0].showDays[1].bisJudge?.judgeCode, "BIS");
const dayTwoLabradors = hierarchy[0].showDays[1].groups[0].breeds[0].dogResults;
const resultJudgeRow = dayTwoLabradors.find((row) => row.showEntryId === "entry-labrador-day-2");
const blockJudgeRow = dayTwoLabradors.find((row) => row.showEntryId === "entry-block");
const scheduledJudgeRow = dayTwoLabradors.find((row) => row.showEntryId === "entry-scheduled");
assert.equal(resultJudgeRow?.result?.championshipPointsAwarded, 4);
assert.deepEqual(resultJudgeRow?.result?.grandChampionCredits, [{ pointsAwarded: 3, isMajor: true }]);
assert.equal(resultJudgeRow?.breedJudge?.source, "SHOW_RESULT");
assert.equal(blockJudgeRow?.breedJudge?.source, "SHOW_JUDGING_BLOCK");
assert.equal(scheduledJudgeRow?.breedJudge?.source, "SCHEDULED_GROUP_ASSIGNMENT");
assert.equal(hierarchy[0].showDays[1].groups[2].name, "Unmapped group (Legacy Group)");

const loader = readFileSync(join(root, "app", "my-results", "myResults.loader.ts"), "utf8");
assert.ok(loader.includes("kennelId: args.kennelId"), "query remains historically scoped by ShowEntry.kennelId");
assert.equal(loader.includes("take:"), false, "query has no arbitrary row limit");
assert.equal(loader.includes("ownerKennelId"), false, "query does not use current dog ownership");

const page = readFileSync(join(root, "app", "my-results", "page.tsx"), "utf8");
assert.equal(page.includes("buildCompatibilityShows"), false, "page does not rebuild the legacy Cluster to Breed shape");
assert.equal(page.includes("new Map"), false, "page does not independently group hierarchy nodes");
assert.equal(page.includes(".sort("), false, "page does not independently order hierarchy nodes");
assert.ok(page.includes("<MyResultsAccordion hierarchy={hierarchy} />"), "page passes the loader hierarchy directly to the accordion");

const accordion = readFileSync(join(root, "app", "my-results", "MyResultsAccordion.tsx"), "utf8");
assert.ok(accordion.includes('"use client"'), "accordion owns presentation-only expansion state");
assert.ok(accordion.includes("useState<ReadonlySet<string>>"), "accordion supports independently expanded branches");
assert.ok(accordion.includes("<button"), "accordion uses semantic button controls");
assert.ok(accordion.includes("aria-expanded={props.expanded}"), "accordion exposes expanded state");
assert.ok(accordion.includes("focus-visible:outline"), "accordion has a visible keyboard focus treatment");
assert.equal(accordion.includes(".sort("), false, "accordion does not independently order hierarchy nodes");
assert.equal(accordion.includes("new Map"), false, "accordion does not independently group hierarchy nodes");
assert.equal(accordion.includes("loadMyResultsHierarchy"), false, "accordion does not fetch data on expansion");

console.log("My Results hierarchy checks passed.");
