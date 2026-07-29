import {
  CANONICAL_SHOW_GROUP_CODES,
  CANONICAL_SHOW_GROUP_LABELS,
  isCanonicalShowGroupCode,
  resolveBreedGroupNameToCanonicalShowGroupCode,
} from "./canonicalShowGroups";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertThrows(action: () => unknown, label: string): void {
  try {
    action();
  } catch {
    return;
  }

  throw new Error(`${label}: expected resolver to throw`);
}

const expectedGroupCodes = [
  "SPORTING",
  "HOUND",
  "WORKING",
  "TERRIER",
  "TOY",
  "NON_SPORTING",
  "HERDING",
  "MISCELLANEOUS",
];

assertEqual(
  CANONICAL_SHOW_GROUP_CODES.join(","),
  expectedGroupCodes.join(","),
  "canonical group order"
);

for (const groupCode of CANONICAL_SHOW_GROUP_CODES) {
  const label = CANONICAL_SHOW_GROUP_LABELS[groupCode];
  assertEqual(
    resolveBreedGroupNameToCanonicalShowGroupCode(label),
    groupCode,
    `${label} resolver`
  );
  assertEqual(isCanonicalShowGroupCode(groupCode), true, `${groupCode} type guard`);
}

assertThrows(
  () => resolveBreedGroupNameToCanonicalShowGroupCode(null),
  "null group name"
);
assertThrows(
  () => resolveBreedGroupNameToCanonicalShowGroupCode("   "),
  "blank group name"
);
assertThrows(
  () => resolveBreedGroupNameToCanonicalShowGroupCode("Other"),
  "Other group name"
);
assertThrows(
  () => resolveBreedGroupNameToCanonicalShowGroupCode("Other Breeds"),
  "Other Breeds group name"
);
assertThrows(
  () => resolveBreedGroupNameToCanonicalShowGroupCode("Unknown"),
  "unknown group name"
);
assertEqual(isCanonicalShowGroupCode("Other"), false, "invalid type guard");

console.log("Canonical show group checks passed.");
