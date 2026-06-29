const YEAR_13_REGULAR_SHOW_PAUSE_YEAR = 13;
const GENERATED_REGULAR_SHOW_PREFIX = `generated-year-${YEAR_13_REGULAR_SHOW_PAUSE_YEAR}-`;

export const YEAR_13_REGULAR_SHOW_PAUSE_MESSAGE =
  "Year 13 regular show entries are temporarily paused while the district circuit schedule is being corrected.";

type ShowClusterPauseCandidate = {
  id?: string | null;
  year?: number | null;
};

// TODO: Remove this temporary migration guard after Year 13 generated regular
// show clusters are corrected to the fixed district circuit rotation.
export function isYear13RegularShowPaused(
  cluster: ShowClusterPauseCandidate
): boolean {
  return (
    cluster.year === YEAR_13_REGULAR_SHOW_PAUSE_YEAR &&
    Boolean(cluster.id?.startsWith(GENERATED_REGULAR_SHOW_PREFIX))
  );
}

export function assertYear13RegularShowEntryNotPaused(
  cluster: ShowClusterPauseCandidate
): void {
  if (isYear13RegularShowPaused(cluster)) {
    throw new Error(YEAR_13_REGULAR_SHOW_PAUSE_MESSAGE);
  }
}
