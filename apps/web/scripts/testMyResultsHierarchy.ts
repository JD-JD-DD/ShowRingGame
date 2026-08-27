import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildMyResultsHierarchy,
  MY_RESULTS_CLUSTER_PAGE_SIZE,
  selectMyResultsClusterPage,
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
const zeroPointAward = entry({
  id: "entry-zero-point-award",
  dog: { id: "dog-zero", callName: "Zero", registeredName: "Zero Point Dog", regNumber: "ZERO-1", visibleTitlePrefix: null, visibleTitleSuffix: null },
  showResult: {
    pointsAwarded: 0,
    isMajor: false,
    judge: { name: "Result Judge", judgeCode: "RESULT" },
    showAwards: [{ awardCode: "RWD", grandChampionCredit: null }],
  },
});
const multiAward = entry({
  id: "entry-multi-award",
  dog: { id: "dog-multi", callName: "Multi", registeredName: "Multiple Award Dog", regNumber: "MULTI-1", visibleTitlePrefix: null, visibleTitleSuffix: null },
  showResult: {
    pointsAwarded: 3,
    isMajor: true,
    judge: { name: "Result Judge", judgeCode: "RESULT" },
    showAwards: [
      { awardCode: "WB", grandChampionCredit: null },
      { awardCode: "BOW", grandChampionCredit: null },
      { awardCode: "BOS", grandChampionCredit: null },
    ],
  },
});
const unresolvedJudge = entry({
  id: "entry-unresolved-judge",
  dog: { id: "dog-unresolved", callName: "Unknown", registeredName: "Unresolved Judge Dog", regNumber: "UNKNOWN-1", visibleTitlePrefix: null, visibleTitleSuffix: null },
  showResult: null,
  judgingBlock: null,
  showDay: { ...entry().showDay, groupJudgeAssignments: [] },
});

const hierarchy = buildMyResultsHierarchy([toy, dayOneLabrador, entry(), blockFallback, scheduledFallback, unmapped, zeroPointAward, multiAward, unresolvedJudge]);
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
assert.equal(resultJudgeRow?.breedJudge?.judge.judgeCode, "RESULT");
assert.equal(blockJudgeRow?.breedJudge?.judge.judgeCode, "BLOCK");
assert.equal(scheduledJudgeRow?.breedJudge?.judge.judgeCode, "SCHEDULED");
assert.equal(hierarchy[0].showDays[1].groups[2].name, "Unmapped group (Legacy Group)");
assert.equal(unresolvedJudge.breed.groupName, "Sporting");
assert.equal(hierarchy[0].showDays[1].groups[0].breeds[0].dogResults.find((row) => row.showEntryId === "entry-unresolved-judge")?.breedJudge, null);
assert.deepEqual(
  hierarchy[0].showDays[1].groups[0].breeds[0].dogResults.find((row) => row.showEntryId === "entry-zero-point-award")?.result?.awardCodes,
  ["RWD"],
  "zero-point awards remain present in the historical result"
);
assert.deepEqual(
  hierarchy[0].showDays[1].groups[0].breeds[0].dogResults.find((row) => row.showEntryId === "entry-multi-award")?.result?.awardCodes,
  ["WB", "BOW", "BOS"],
  "multi-award historical paths preserve every stored award in order"
);

const dayTwoOnlyHierarchy = buildMyResultsHierarchy([entry(), toy]);
assert.deepEqual(dayTwoOnlyHierarchy[0].showDays.map((day) => day.id), ["day-2"], "kennel entries only on Day 2 do not manufacture other days");
assert.deepEqual(dayTwoOnlyHierarchy[0].showDays[0].groups.map((group) => group.code), ["SPORTING", "TOY"]);

const sparseHierarchy = buildMyResultsHierarchy([entry()]);
assert.equal(sparseHierarchy.length, 1, "one historical entry retains its cluster");
assert.equal(sparseHierarchy[0].showDays.length, 1, "one historical entry retains its show day");
assert.equal(sparseHierarchy[0].showDays[0].groups.length, 1, "one historical entry retains its group");
assert.equal(sparseHierarchy[0].showDays[0].groups[0].breeds.length, 1, "one historical entry retains its breed");
assert.equal(sparseHierarchy[0].showDays[0].groups[0].breeds[0].dogResults.length, 1, "one historical entry retains its dog result");
assert.deepEqual(buildMyResultsHierarchy([]), [], "no qualifying history produces an empty hierarchy");

const dogTieHierarchy = buildMyResultsHierarchy([
  entry({ id: "entry-b", dog: { id: "dog-b", callName: "Tie", registeredName: "Tie Dog", regNumber: "REG-2", visibleTitlePrefix: null, visibleTitleSuffix: null } }),
  entry({ id: "entry-a", dog: { id: "dog-a", callName: "Tie", registeredName: "Tie Dog", regNumber: "REG-1", visibleTitlePrefix: null, visibleTitleSuffix: null } }),
]);
assert.deepEqual(
  dogTieHierarchy[0].showDays[0].groups[0].breeds[0].dogResults.map((row) => row.showEntryId),
  ["entry-a", "entry-b"],
  "dog result ties use registration number before ShowEntry ID"
);

const clusterCandidates = Array.from({ length: 21 }, (_, index) => ({
  clusterId: `cluster-${String(index).padStart(2, "0")}`,
  mostRecentShowDayEpoch: 210 - index,
}));
const firstClusterPage = selectMyResultsClusterPage({ candidates: clusterCandidates });
assert.equal(MY_RESULTS_CLUSTER_PAGE_SIZE, 10, "cluster pages contain ten clusters");
assert.deepEqual(firstClusterPage.clusterIds, clusterCandidates.slice(0, 10).map((candidate) => candidate.clusterId));
assert.deepEqual(firstClusterPage.nextCursor, clusterCandidates[9]);
const secondClusterPage = selectMyResultsClusterPage({
  candidates: clusterCandidates,
  cursor: firstClusterPage.nextCursor,
});
assert.deepEqual(secondClusterPage.clusterIds, clusterCandidates.slice(10, 20).map((candidate) => candidate.clusterId));
assert.equal(secondClusterPage.clusterIds.some((clusterId) => firstClusterPage.clusterIds.includes(clusterId)), false);
const thirdClusterPage = selectMyResultsClusterPage({
  candidates: clusterCandidates,
  cursor: secondClusterPage.nextCursor,
});
assert.deepEqual(thirdClusterPage.clusterIds, ["cluster-20"]);
assert.equal(thirdClusterPage.nextCursor, null, "the final partial cluster page has no continuation");
const fewerThanTenPage = selectMyResultsClusterPage({ candidates: clusterCandidates.slice(0, 9) });
assert.equal(fewerThanTenPage.nextCursor, null, "fewer than ten clusters need no Load more control");
const exactlyTenPage = selectMyResultsClusterPage({ candidates: clusterCandidates.slice(0, 10) });
assert.equal(exactlyTenPage.nextCursor, null, "exactly ten clusters need no Load more control");

const loader = readFileSync(join(root, "app", "my-results", "myResults.loader.ts"), "utf8");
assert.ok(loader.includes("kennelId: args.kennelId"), "query remains historically scoped by ShowEntry.kennelId");
assert.equal(loader.includes("take:"), false, "query has no arbitrary row limit");
assert.equal(loader.includes("ownerKennelId"), false, "query does not use current dog ownership");
assert.ok(loader.includes("showDay: { clusterId: { in: page.clusterIds } }"), "selected clusters load all qualifying entries by cluster ID");
assert.ok(loader.includes("selectMyResultsClusterPage"), "cluster selection uses a stable continuation helper");
assert.equal((loader.match(/db\.showDay\.findMany/g) ?? []).length, 1, "Step A uses one qualifying-ShowDay metadata query per batch");
assert.equal((loader.match(/db\.showEntry\.findMany/g) ?? []).length, 1, "Step B uses one selected-cluster entry query per batch");
assert.ok(loader.includes("select: { clusterId: true, scheduledEpoch: true }"), "Step A does not load complete result payloads");
assert.equal(loader.includes("db.showCluster.findMany"), false, "Step A does not load public cluster result trees");

const page = readFileSync(join(root, "app", "my-results", "page.tsx"), "utf8");
assert.equal(page.includes("buildCompatibilityShows"), false, "page does not rebuild the legacy Cluster to Breed shape");
assert.equal(page.includes("new Map"), false, "page does not independently group hierarchy nodes");
assert.equal(page.includes(".sort("), false, "page does not independently order hierarchy nodes");
assert.ok(page.includes("initialHierarchy={resultsPage.hierarchy}"), "page passes the initial cluster page directly to the accordion");
assert.ok(page.includes("initialNextCursor={resultsPage.nextCursor}"), "page passes the continuation cursor to the accordion");

const accordion = readFileSync(join(root, "app", "my-results", "MyResultsAccordion.tsx"), "utf8");
assert.ok(accordion.includes('"use client"'), "accordion owns presentation-only expansion state");
assert.ok(accordion.includes("useState<ReadonlySet<string>>"), "accordion supports independently expanded branches");
assert.ok(accordion.includes("<button"), "accordion uses semantic button controls");
assert.ok(accordion.includes("aria-expanded={props.expanded}"), "accordion exposes expanded state");
assert.ok(accordion.includes("focus-visible:outline"), "accordion has a visible keyboard focus treatment");
assert.equal(accordion.includes(".sort("), false, "accordion does not independently order hierarchy nodes");
assert.equal(accordion.includes("new Map"), false, "accordion does not independently group hierarchy nodes");
assert.equal(accordion.includes("loadMyResultsHierarchy"), false, "accordion does not fetch data on expansion");
assert.ok(accordion.includes("loadMoreMyResults"), "accordion uses the server action only for explicit Load more pagination");
const clusterActionArea = accordion.slice(
  accordion.indexOf("<section key={cluster.id}"),
  accordion.indexOf("{clusterExpanded ?"),
);
const clusterExpandButton = clusterActionArea.slice(
  clusterActionArea.indexOf("<ExpandButton"),
  clusterActionArea.indexOf("</ExpandButton>") + "</ExpandButton>".length,
);
assert.ok(clusterActionArea.includes('href={`/shows/${cluster.id}/results`}'), "each cluster links to its canonical full results route");
assert.ok(clusterActionArea.includes("View Full Results"), "each cluster exposes a full-results link");
assert.equal(clusterExpandButton.includes("<Link"), false, "the full-results link is not nested in the accordion button");
assert.ok(clusterActionArea.includes("focus-visible:outline"), "the full-results link has a visible keyboard focus treatment");
assert.ok(accordion.includes("setHierarchy((current) => [...current, ...nextPage.hierarchy])"), "Load more appends older clusters");
assert.ok(accordion.includes("disabled={isLoadingMore}"), "Load more prevents concurrent requests");
assert.ok(accordion.includes('"Load more"'), "Load more uses a native button label");
assert.equal(accordion.includes("fetch("), false, "accordion does not issue direct network requests while expanding");
assert.ok(accordion.includes("summarizeGroupJudge"), "accordion checks actual judge uniformity across a group");
assert.ok(accordion.includes("summarizeBreedJudge"), "accordion checks actual judge uniformity within a breed");
assert.ok(accordion.includes("Multiple judges"), "mixed judge attribution has a neutral group or breed display");
assert.ok(accordion.includes("showDogJudge"), "mixed breed attribution is shown at the dog-result level");
assert.equal(accordion.includes("group.judge?.judge"), false, "accordion does not display a representative group judge as universal attribution");
assert.ok(accordion.includes('replaceAll(", ", " / ")'), "multiple stored awards render on one slash-separated line");
assert.ok(accordion.includes("formatTitlePointsDisplay(buildTitlePointsDisplay"), "point display retains the existing title-point helper semantics");
assert.ok(accordion.includes('replace(" major", " · Major")'), "major status is communicated in text");
assert.equal(accordion.includes("No title points"), false, "zero-point results do not manufacture point text");
assert.ok(accordion.includes('if (entry.entryStatus === "ABSENT") return "Absent"'), "absence remains distinct from DNP");
assert.ok(accordion.includes('if (entry.entryStatus === "INELIGIBLE") return "Ineligible"'), "ineligible status remains distinct");
assert.ok(accordion.includes('if (entry.entryStatus === "JUDGED") return "DNP"'), "judged rows without awards remain DNP");
assert.ok(accordion.includes("formatJudgeName"), "unresolved judges retain the player-facing unavailable label");
assert.ok(page.includes("No judged show results yet."), "page retains a concise empty state");

console.log("My Results hierarchy checks passed.");
