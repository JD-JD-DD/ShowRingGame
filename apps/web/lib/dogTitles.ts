export const CONFORMATION_CHAMPION_OF_RECORD_TITLE_CODES = [
  "CH",
  "GCH",
  "GCHB",
  "GCHS",
  "GCHG",
  "GCHP",
  "GCHP2",
  "GCHP3",
  "GCHP4",
  "GCHP5",
] as const;

const CHAMPION_OF_RECORD_TITLE_CODE_SET = new Set<string>(
  CONFORMATION_CHAMPION_OF_RECORD_TITLE_CODES
);

export type ChampionOfRecordTitleCode =
  (typeof CONFORMATION_CHAMPION_OF_RECORD_TITLE_CODES)[number];

export type ChampionOfRecordDogLike = {
  visibleTitlePrefix?: string | null;
  visibleTitleSuffix?: string | null;
  currentTitleCode?: string | null;
  titleProgress?: {
    currentTitleCode?: string | null;
  } | null;
};

function normalizeTitleCode(titleCode: string | null | undefined): string {
  return titleCode?.trim().toUpperCase() ?? "";
}

export function isChampionOfRecordTitleCode(
  titleCode: string | null | undefined
): boolean {
  return CHAMPION_OF_RECORD_TITLE_CODE_SET.has(normalizeTitleCode(titleCode));
}

export function isChampionOfRecordPrefix(
  prefix: string | null | undefined
): boolean {
  return isChampionOfRecordTitleCode(prefix);
}

export function isChampionOfRecordDog(dog: ChampionOfRecordDogLike): boolean {
  return (
    isChampionOfRecordTitleCode(
      dog.titleProgress?.currentTitleCode ?? dog.currentTitleCode
    ) ||
    isChampionOfRecordPrefix(dog.visibleTitlePrefix) ||
    isChampionOfRecordTitleCode(dog.visibleTitleSuffix)
  );
}

export function getChampionOfRecordTitleLevel(
  dog: ChampionOfRecordDogLike
): "NONE" | "CH_OR_HIGHER" | "GCH_OR_HIGHER" {
  const titleCodes = [
    dog.titleProgress?.currentTitleCode ?? dog.currentTitleCode,
    dog.visibleTitlePrefix,
    dog.visibleTitleSuffix,
  ];

  if (
    titleCodes.some(
      (titleCode) =>
        isChampionOfRecordTitleCode(titleCode) &&
        normalizeTitleCode(titleCode) !== "CH"
    )
  ) {
    return "GCH_OR_HIGHER";
  }

  return titleCodes.some(isChampionOfRecordTitleCode)
    ? "CH_OR_HIGHER"
    : "NONE";
}
