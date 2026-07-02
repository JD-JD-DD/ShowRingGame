const YEAR_13_REGULAR_SHOW_PAUSE_YEAR = 13;
const LEGACY_YEAR_13_REGULAR_SHOW_PATTERN =
  /^generated-year-13-week-\d+-slot-\d+$/;
const CORRECTED_YEAR_13_REGULAR_SHOW_PATTERN =
  /^generated-year-13-fixed-week-\d+-slot-\d+$/;

export const YEAR_13_REGULAR_SHOW_PAUSE_MESSAGE =
  "Year 13 regular show entries are temporarily paused while the district circuit schedule is being corrected.";

type ShowClusterPauseCandidate = {
  id?: string | null;
  year?: number | null;
};

export function getYear13CorrectedRegularShowClusterId(args: {
  weekInYear: number;
  slotIndex: number;
}): string {
  return `generated-year-${YEAR_13_REGULAR_SHOW_PAUSE_YEAR}-fixed-week-${args.weekInYear}-slot-${args.slotIndex}`;
}

export function isLegacyYear13RegularShowClusterId(
  clusterId: string | null | undefined
): boolean {
  return Boolean(clusterId?.match(LEGACY_YEAR_13_REGULAR_SHOW_PATTERN));
}

export function isCorrectedYear13RegularShowClusterId(
  clusterId: string | null | undefined
): boolean {
  return Boolean(clusterId?.match(CORRECTED_YEAR_13_REGULAR_SHOW_PATTERN));
}

export function isYear13GeneratedRegularShowClusterId(
  clusterId: string | null | undefined
): boolean {
  return (
    isLegacyYear13RegularShowClusterId(clusterId) ||
    isCorrectedYear13RegularShowClusterId(clusterId)
  );
}

export function isYear13RegularShowPaused(
  _cluster: ShowClusterPauseCandidate
): boolean {
  void _cluster;

  return false;
}

export function assertYear13RegularShowEntryNotPaused(
  cluster: ShowClusterPauseCandidate
): void {
  if (isYear13RegularShowPaused(cluster)) {
    throw new Error(YEAR_13_REGULAR_SHOW_PAUSE_MESSAGE);
  }
}
