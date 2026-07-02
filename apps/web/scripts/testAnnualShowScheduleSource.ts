import assert from "node:assert/strict";

import {
  generateAnnualShowClusterTemplates,
  SHOW_YEAR_HOURS,
} from "@showring/rules";

import {
  generateFixedShowClustersForYear,
  generateShowClustersInHorizonForScheduleSources,
  getAnnualShowCalendarTemplatesForYear,
  getFixedGeneratedShowClusterId,
  getGeneratedRegularTemplateId,
  getRuntimeGeneratedShowClusterId,
  getWeek51RegularClusterIdsForYear,
  isArchivedYear13LegacyRepairCluster,
  usesFixedAnnualShowSchedule,
} from "../server/services/annualShowSchedule.service";
import { isYear13RegularShowPaused } from "../server/services/showScheduleMigration.service";

assert.equal(usesFixedAnnualShowSchedule(12), false);
assert.equal(usesFixedAnnualShowSchedule(13), true);
assert.equal(usesFixedAnnualShowSchedule(14), true);

assert.equal(
  getFixedGeneratedShowClusterId({ year: 13, weekInYear: 1, slotIndex: 2 }),
  "generated-year-13-fixed-week-1-slot-2"
);
assert.equal(
  getFixedGeneratedShowClusterId({ year: 14, weekInYear: 51, slotIndex: 3 }),
  "generated-year-14-fixed-week-51-slot-3"
);

assert.equal(
  getGeneratedRegularTemplateId("generated-year-12-week-3-slot-2"),
  "week-3-slot-2"
);
assert.equal(
  getGeneratedRegularTemplateId("generated-year-13-fixed-week-3-slot-2"),
  "week-3-slot-2"
);

const legacyYear12Templates = getAnnualShowCalendarTemplatesForYear(12);
const legacyRuleTemplates = generateAnnualShowClusterTemplates();
assert.equal(legacyYear12Templates.length, legacyRuleTemplates.length);
assert.equal(legacyYear12Templates[0]?.templateId, legacyRuleTemplates[0]?.templateId);
assert.equal(legacyYear12Templates[0]?.district, legacyRuleTemplates[0]?.district);

const year13Templates = getAnnualShowCalendarTemplatesForYear(13);
assert.equal(year13Templates.length, 153);
assert.deepEqual(
  year13Templates
    .filter((template) => template.weekInYear === 1)
    .map((template) => template.district),
  [1, 6, 11]
);
assert.deepEqual(
  year13Templates
    .filter((template) => template.weekInYear === 51)
    .map((template) => template.district),
  [1, 6, 11]
);
assert.equal(
  year13Templates.some((template) => template.weekInYear === 52),
  false
);

const year13FixedClusters = generateFixedShowClustersForYear(13);
assert.equal(year13FixedClusters.length, 153);
assert.equal(
  year13FixedClusters.reduce(
    (total, cluster) => total + cluster.showDayEpochs.length,
    0
  ),
  366
);
assert.equal(
  year13FixedClusters[0]?.generatedClusterId,
  "generated-year-13-fixed-week-1-slot-1"
);
assert.equal(
  year13FixedClusters[0]
    ? getRuntimeGeneratedShowClusterId(year13FixedClusters[0])
    : null,
  "generated-year-13-fixed-week-1-slot-1"
);
assert.equal(
  year13FixedClusters.some((cluster) => cluster.weekInYear === 52),
  false
);

const year14FixedClusters = generateFixedShowClustersForYear(14);
assert.equal(
  year14FixedClusters[0]?.generatedClusterId,
  "generated-year-14-fixed-week-1-slot-1"
);

const year13HorizonClusters = generateShowClustersInHorizonForScheduleSources({
  currentEpoch: (13 - 1) * SHOW_YEAR_HOURS,
  horizonHours: 20,
});
assert.equal(
  year13HorizonClusters.some(
    (cluster) =>
      cluster.generatedClusterId === "generated-year-13-fixed-week-1-slot-1"
  ),
  true
);
assert.equal(
  year13HorizonClusters.some((cluster) =>
    (cluster.generatedClusterId ?? `generated-year-${cluster.year}-${cluster.templateId}`).startsWith(
      "generated-year-13-week-"
    )
  ),
  false
);

const week51Year12Ids = getWeek51RegularClusterIdsForYear(12);
const week51Year13Ids = getWeek51RegularClusterIdsForYear(13);
assert.equal(
  week51Year12Ids.every((id) => id.startsWith("generated-year-12-week-51-slot-")),
  true
);
assert.deepEqual(week51Year13Ids, [
  "generated-year-13-fixed-week-51-slot-1",
  "generated-year-13-fixed-week-51-slot-2",
  "generated-year-13-fixed-week-51-slot-3",
]);

assert.equal(
  isArchivedYear13LegacyRepairCluster({
    id: "generated-year-13-week-1-slot-1",
    status: "CANCELLED",
  }),
  true
);
assert.equal(
  isArchivedYear13LegacyRepairCluster({
    id: "generated-year-13-fixed-week-1-slot-1",
    status: "CANCELLED",
  }),
  false
);
assert.equal(
  isYear13RegularShowPaused({
    id: "generated-year-13-fixed-week-1-slot-1",
    year: 13,
  }),
  false
);

console.log("Annual show schedule source checks passed.");
