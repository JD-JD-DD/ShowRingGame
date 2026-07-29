export const CANONICAL_SHOW_GROUP_CODES = [
  "SPORTING",
  "HOUND",
  "WORKING",
  "TERRIER",
  "TOY",
  "NON_SPORTING",
  "HERDING",
  "MISCELLANEOUS",
] as const;

export type CanonicalShowGroupCode =
  (typeof CANONICAL_SHOW_GROUP_CODES)[number];

export const CANONICAL_SHOW_GROUP_LABELS: Record<
  CanonicalShowGroupCode,
  string
> = {
  SPORTING: "Sporting",
  HOUND: "Hound",
  WORKING: "Working",
  TERRIER: "Terrier",
  TOY: "Toy",
  NON_SPORTING: "Non-Sporting",
  HERDING: "Herding",
  MISCELLANEOUS: "Miscellaneous",
};

const GROUP_CODE_BY_BREED_GROUP_NAME: Record<string, CanonicalShowGroupCode> = {
  Sporting: "SPORTING",
  Hound: "HOUND",
  Working: "WORKING",
  Terrier: "TERRIER",
  Toy: "TOY",
  "Non-Sporting": "NON_SPORTING",
  Herding: "HERDING",
  Miscellaneous: "MISCELLANEOUS",
};

export function isCanonicalShowGroupCode(
  value: unknown
): value is CanonicalShowGroupCode {
  return (
    typeof value === "string" &&
    (CANONICAL_SHOW_GROUP_CODES as readonly string[]).includes(value)
  );
}

export function getCanonicalShowGroupLabel(
  groupCode: CanonicalShowGroupCode
): string {
  return CANONICAL_SHOW_GROUP_LABELS[groupCode];
}

export function resolveBreedGroupNameToCanonicalShowGroupCode(
  groupName: string | null | undefined
): CanonicalShowGroupCode {
  if (typeof groupName !== "string" || !groupName.trim()) {
    throw new Error("Breed group name must be a non-empty supported group label.");
  }

  const groupCode = GROUP_CODE_BY_BREED_GROUP_NAME[groupName.trim()];

  if (!groupCode) {
    throw new Error(`Unsupported breed group name: ${JSON.stringify(groupName)}.`);
  }

  return groupCode;
}
