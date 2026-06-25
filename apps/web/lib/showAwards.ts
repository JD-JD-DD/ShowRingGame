const SHOW_AWARD_LABELS: Record<string, string> = {
  SELECT_DOG: "Select Dog",
  SELECT_BITCH: "Select Bitch",
};

export function formatShowAwardLabel(awardCode: string): string {
  return SHOW_AWARD_LABELS[awardCode] ?? awardCode;
}

export function formatShowAwardLabels(awardCodes: string[]): string {
  return awardCodes.map(formatShowAwardLabel).join(", ");
}
