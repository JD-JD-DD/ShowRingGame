export type TitlePointsDisplay = {
  value: number;
  track: "CH" | "GCH" | null;
  label: "CH pts" | "GCH pts" | "pts";
  isMajor: boolean;
};

export function buildTitlePointsDisplay(args: {
  championshipPointsAwarded: number;
  isChampionshipMajor: boolean;
  grandChampionCredits: Array<{
    pointsAwarded: number;
    isMajor: boolean;
  }>;
}): TitlePointsDisplay {
  const grandChampionPointsAwarded = args.grandChampionCredits.reduce(
    (total, credit) => total + credit.pointsAwarded,
    0
  );

  if (grandChampionPointsAwarded > 0) {
    return {
      value: grandChampionPointsAwarded,
      track: "GCH",
      label: "GCH pts",
      isMajor: args.grandChampionCredits.some((credit) => credit.isMajor),
    };
  }

  if (args.championshipPointsAwarded > 0) {
    return {
      value: args.championshipPointsAwarded,
      track: "CH",
      label: "CH pts",
      isMajor: args.isChampionshipMajor,
    };
  }

  return {
    value: 0,
    track: null,
    label: "pts",
    isMajor: false,
  };
}

export function formatTitlePointsDisplay(
  display: TitlePointsDisplay
): string | null {
  if (display.value <= 0 || display.track === null) {
    return null;
  }

  return `${display.value} ${display.label}${display.isMajor ? " major" : ""}`;
}
