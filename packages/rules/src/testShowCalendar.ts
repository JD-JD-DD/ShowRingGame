import {
  CIRCUIT_COLUMNS,
  generateAnnualShowClusterTemplates,
  generateShowClustersForWeek,
  SHOW_ENTRY_CLOSE_OFFSET_HOURS,
  SHOW_ENTRY_OPEN_LEAD_HOURS,
  SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
  SHOW_DISTRICT_COUNT,
} from "../src/index";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const templates = generateAnnualShowClusterTemplates();
const firstFourDayTemplate = templates.find(
  (template) => template.type === "FOUR_DAY"
);
const firstTwoDayTemplate = templates.find(
  (template) => template.type === "TWO_DAY"
);

assertEqual(
  SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
  120,
  "show generation horizon"
);
assertEqual(SHOW_ENTRY_OPEN_LEAD_HOURS, 120, "show entry open lead");
assertEqual(SHOW_ENTRY_CLOSE_OFFSET_HOURS, 14, "show entry close offset");

if (!firstFourDayTemplate) {
  throw new Error("expected at least one four-day cluster template");
}

if (!firstTwoDayTemplate) {
  throw new Error("expected at least one two-day cluster template");
}

assertEqual(
  firstFourDayTemplate.showDayOffsets.join("|"),
  "4|5|6|7",
  "four-day cluster chronological offsets"
);
assertEqual(
  firstFourDayTemplate.showDayNames.join("|"),
  "Friday|Saturday|Sunday|Monday",
  "four-day cluster chronological day names"
);

const generatedFourDayCluster = generateShowClustersForWeek(
  (firstFourDayTemplate.weekInYear - 1) * 7
).find((cluster) => cluster.type === "FOUR_DAY");
const generatedTwoDayCluster = generateShowClustersForWeek(
  (firstTwoDayTemplate.weekInYear - 1) * 7
).find((cluster) => cluster.type === "TWO_DAY");

if (!generatedFourDayCluster) {
  throw new Error("expected generated four-day cluster");
}

if (!generatedTwoDayCluster) {
  throw new Error("expected generated two-day cluster");
}

assertEqual(
  generatedFourDayCluster.showDayEpochs
    .map((epoch) => epoch - generatedFourDayCluster.startEpoch)
    .join("|"),
  "0|1|2|3",
  "four-day generated judging epoch offsets"
);
assertEqual(
  generatedTwoDayCluster.showDayEpochs
    .map((epoch) => epoch - generatedTwoDayCluster.startEpoch)
    .join("|"),
  "0|1",
  "two-day generated judging epoch offsets"
);

const expectedWeeklyDistricts = [
  [1, 6, 11],
  [2, 7, 12],
  [3, 8, 13],
  [4, 9, 14],
  [5, 10, 15],
  [1, 6, 11],
];

for (const [index, expectedDistricts] of expectedWeeklyDistricts.entries()) {
  const weekInYear = index + 1;
  const districts = templates
    .filter((template) => template.weekInYear === weekInYear)
    .map((template) => template.district)
    .join(",");

  assertEqual(
    districts,
    expectedDistricts.join(","),
    `week ${weekInYear} district circuit`
  );
}

assertEqual(templates.length, 153, "annual regular district show count");
assertEqual(
  templates.filter((template) => template.weekInYear === 52).length,
  0,
  "week 52 regular district show count"
);
assertEqual(
  generateShowClustersForWeek(357).length,
  0,
  "generated week 52 regular district show count"
);

for (const weekInYear of [17, 34, 51]) {
  assertEqual(
    templates.filter((template) => template.weekInYear === weekInYear).length,
    3,
    `week ${weekInYear} regular district show count`
  );
}

assertEqual(
  templates
    .filter((template) => template.weekInYear === 51)
    .map((template) => template.district)
    .join(","),
  "1,6,11",
  "week 51 district circuit"
);

for (let district = 1; district <= SHOW_DISTRICT_COUNT; district += 1) {
  const districtShows = templates.filter(
    (template) => template.district === district
  );
  const expectedAnnualCount = CIRCUIT_COLUMNS[0].includes(
    district as (typeof CIRCUIT_COLUMNS)[0][number]
  )
    ? 11
    : 10;
  const expectedTwoDayCount = expectedAnnualCount - 2;

  assertEqual(
    districtShows.length,
    expectedAnnualCount,
    `district ${district} annual show count`
  );
  assertEqual(
    districtShows.filter((template) => template.type === "FOUR_DAY").length,
    2,
    `district ${district} four-day cluster count`
  );
  assertEqual(
    districtShows.filter((template) => template.type === "TWO_DAY").length,
    expectedTwoDayCount,
    `district ${district} two-day cluster count`
  );
}

const twoDayOnlyWeeks = Array.from({ length: 51 }, (_, index) => index + 1)
  .filter((weekInYear) =>
    templates
      .filter((template) => template.weekInYear === weekInYear)
      .every((template) => template.type === "TWO_DAY")
  );

if (twoDayOnlyWeeks.length === 0) {
  throw new Error("expected at least one week with only two-day district shows");
}

const yearOneWeekOneDistricts = generateShowClustersForWeek(0)
  .map((cluster) => cluster.district)
  .join(",");
const yearTwoWeekOneDistricts = generateShowClustersForWeek(365)
  .map((cluster) => cluster.district)
  .join(",");

assertEqual(yearOneWeekOneDistricts, "1,6,11", "year 1 week 1 districts");
assertEqual(yearTwoWeekOneDistricts, "1,6,11", "year 2 week 1 districts");
assertEqual(
  yearTwoWeekOneDistricts,
  yearOneWeekOneDistricts,
  "fixed district circuit repeats by show year"
);

console.log("Show calendar checks passed.");
