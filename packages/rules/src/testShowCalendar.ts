import {
  generateAnnualShowClusterTemplates,
  generateShowClustersForWeek,
  SHOW_DISTRICT_COUNT,
} from "../src/index";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const templates = generateAnnualShowClusterTemplates();

assertEqual(templates.length, 150, "annual regular district show count");
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

for (let district = 1; district <= SHOW_DISTRICT_COUNT; district += 1) {
  const districtShows = templates.filter(
    (template) => template.district === district
  );

  assertEqual(districtShows.length, 10, `district ${district} annual show count`);
  assertEqual(
    districtShows.filter((template) => template.type === "FOUR_DAY").length,
    2,
    `district ${district} four-day cluster count`
  );
  assertEqual(
    districtShows.filter((template) => template.type === "TWO_DAY").length,
    8,
    `district ${district} two-day cluster count`
  );
}

for (const weekInYear of [17, 34, 51]) {
  assertEqual(
    templates.filter((template) => template.weekInYear === weekInYear).length,
    2,
    `week ${weekInYear} regular district show count`
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

console.log("Show calendar checks passed.");
