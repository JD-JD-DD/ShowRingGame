import { strict as assert } from "node:assert";

import {
  isChampionOfRecordDog,
  isChampionOfRecordPrefix,
  isChampionOfRecordTitleCode,
} from "../lib/dogTitles";

assert.equal(isChampionOfRecordTitleCode("CH"), true);
assert.equal(isChampionOfRecordTitleCode("GCH"), true);
assert.equal(isChampionOfRecordTitleCode("GCHB"), true);
assert.equal(isChampionOfRecordTitleCode("GCHP5"), true);

assert.equal(isChampionOfRecordTitleCode(null), false);
assert.equal(isChampionOfRecordTitleCode(""), false);
assert.equal(isChampionOfRecordTitleCode("UNKNOWN"), false);

assert.equal(isChampionOfRecordPrefix("GCHS"), true);
assert.equal(
  isChampionOfRecordDog({
    visibleTitlePrefix: "GCHG",
    titleProgress: { currentTitleCode: null },
  }),
  true
);
assert.equal(
  isChampionOfRecordDog({
    visibleTitlePrefix: null,
    titleProgress: { currentTitleCode: "GCHP3" },
  }),
  true
);
assert.equal(
  isChampionOfRecordDog({
    visibleTitlePrefix: null,
    visibleTitleSuffix: "CH",
    titleProgress: null,
  }),
  true
);
assert.equal(
  isChampionOfRecordDog({
    visibleTitlePrefix: null,
    visibleTitleSuffix: null,
    titleProgress: { currentTitleCode: "UNKNOWN" },
  }),
  false
);

console.log("Dog title helper tests passed.");
