import { strict as assert } from "node:assert";

import {
  getGrandChampionCompletionFields,
  getGrandChampionMilestoneTitle,
  getGrandChampionNoticeText,
  getHighestConformationTitle,
  isGrandChampionComplete,
} from "../server/services/titleProgress.service";

function progress(overrides: Partial<Parameters<typeof getHighestConformationTitle>[0]> = {}) {
  return {
    championshipPoints: 15,
    majorCount: 2,
    grandPoints: 25,
    grandMajorCount: 3,
    grandChampionDefeatShowCount: 3,
    currentTitleCode: "CH",
    ...overrides,
  };
}

assert.equal(isGrandChampionComplete(progress({ grandPoints: 24 })), false);
assert.equal(isGrandChampionComplete(progress({ grandMajorCount: 2 })), false);
assert.equal(
  isGrandChampionComplete(progress({ grandChampionDefeatShowCount: 2 })),
  false
);
assert.equal(isGrandChampionComplete(progress()), true);

assert.equal(getHighestConformationTitle(progress({ grandPoints: 24 })), "CH");
assert.equal(getHighestConformationTitle(progress()), "GCH");
assert.equal(getHighestConformationTitle(progress({ grandPoints: 100 })), "GCHB");
assert.equal(getHighestConformationTitle(progress({ grandPoints: 200 })), "GCHS");
assert.equal(getHighestConformationTitle(progress({ grandPoints: 400 })), "GCHG");
assert.equal(getHighestConformationTitle(progress({ grandPoints: 800 })), "GCHP");
assert.equal(getHighestConformationTitle(progress({ grandPoints: 1600 })), "GCHP2");
assert.equal(getHighestConformationTitle(progress({ grandPoints: 2400 })), "GCHP3");
assert.equal(getHighestConformationTitle(progress({ grandPoints: 3200 })), "GCHP4");
assert.equal(getHighestConformationTitle(progress({ grandPoints: 4000 })), "GCHP5");

assert.equal(
  getHighestConformationTitle(
    progress({
      currentTitleCode: null,
      championshipPoints: 14,
      grandPoints: 4000,
    })
  ),
  null
);
assert.equal(getGrandChampionMilestoneTitle(99), "GCH");
assert.equal(getGrandChampionMilestoneTitle(100), "GCHB");

assert.deepEqual(
  getGrandChampionNoticeText({
    dog: {
      registeredName: "Example Dog",
      callName: "Example",
      regNumber: "SRG-1",
      visibleTitlePrefix: "CH",
      visibleTitleSuffix: null,
    },
    titleCode: "GCH",
  }),
  {
    title: "New Grand Champion",
    body: "GCH Example Dog has earned their Grand Champion title.",
  }
);

assert.deepEqual(
  getGrandChampionNoticeText({
    dog: {
      registeredName: "Example Dog",
      callName: "Example",
      regNumber: "SRG-1",
      visibleTitlePrefix: "GCH",
      visibleTitleSuffix: null,
    },
    titleCode: "GCHB",
  }),
  {
    title: "New GCHB title",
    body: "GCHB Example Dog has advanced to GCHB.",
  }
);

assert.deepEqual(
  getGrandChampionCompletionFields({
    progress: {
      currentTitleCode: "CH",
      grandPoints: 25,
      grandMajorCount: 3,
      grandChampionDefeatShowCount: 3,
      grandCompletedAtShowDayId: null,
      grandCompletedAtEpoch: null,
    },
    showDayId: "show-day-new",
    currentEpoch: 123,
  }),
  {
    grandCompletedAtShowDayId: "show-day-new",
    grandCompletedAtEpoch: 123,
  }
);

assert.deepEqual(
  getGrandChampionCompletionFields({
    progress: {
      currentTitleCode: "CH",
      grandPoints: 25,
      grandMajorCount: 3,
      grandChampionDefeatShowCount: 3,
      grandCompletedAtShowDayId: "show-day-original",
      grandCompletedAtEpoch: 99,
    },
    showDayId: "show-day-rerun",
    currentEpoch: 123,
  }),
  {
    grandCompletedAtShowDayId: "show-day-original",
    grandCompletedAtEpoch: 99,
  }
);

assert.deepEqual(
  getGrandChampionCompletionFields({
    progress: {
      currentTitleCode: "GCH",
      grandPoints: 25,
      grandMajorCount: 3,
      grandChampionDefeatShowCount: 3,
      grandCompletedAtShowDayId: "show-day-original",
      grandCompletedAtEpoch: 99,
    },
    showDayId: "show-day-rerun",
    currentEpoch: 123,
  }),
  {}
);

console.log("Grand Champion promotion tests passed.");
