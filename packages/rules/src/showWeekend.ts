import { SHOW_WEEK_HOURS, SHOW_YEAR_HOURS } from "../constants/time.constants";

const GENERATED_CLUSTER_ID_PATTERN =
  /^generated-year-(\d+)-week-(\d+)-slot-\d+$/;
const CORRECTED_GENERATED_CLUSTER_ID_PATTERN =
  /^generated-year-(\d+)-fixed-week-(\d+)-slot-\d+$/;

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

export function getGeneratedShowWeekendKey(clusterId: string): string | null {
  const match =
    clusterId.match(GENERATED_CLUSTER_ID_PATTERN) ??
    clusterId.match(CORRECTED_GENERATED_CLUSTER_ID_PATTERN);

  if (!match) {
    return null;
  }

  return `year-${match[1]}-week-${match[2]}`;
}

export function getGeneratedShowWeekendPrefix(clusterId: string): string | null {
  const legacyMatch = clusterId.match(GENERATED_CLUSTER_ID_PATTERN);

  if (legacyMatch) {
    return `generated-year-${legacyMatch[1]}-week-${legacyMatch[2]}-slot-`;
  }

  const correctedMatch = clusterId.match(CORRECTED_GENERATED_CLUSTER_ID_PATTERN);

  if (!correctedMatch) {
    return null;
  }

  return `generated-year-${correctedMatch[1]}-fixed-week-${correctedMatch[2]}-slot-`;
}

export function getShowWeekendStartEpoch(epoch: number): number {
  assertNonNegativeInteger(epoch, "epoch");

  const yearStartEpoch = Math.floor(epoch / SHOW_YEAR_HOURS) * SHOW_YEAR_HOURS;
  const hourInYear = epoch % SHOW_YEAR_HOURS;
  const showCalendarHourInYear = Math.min(hourInYear, SHOW_YEAR_HOURS - 2);

  return (
    yearStartEpoch +
    showCalendarHourInYear -
    (showCalendarHourInYear % SHOW_WEEK_HOURS)
  );
}

export function getShowWeekendKey(args: {
  clusterId?: string | null;
  startEpoch: number;
}): string {
  const generatedKey = args.clusterId
    ? getGeneratedShowWeekendKey(args.clusterId)
    : null;

  if (generatedKey) {
    return generatedKey;
  }

  const weekendStartEpoch = getShowWeekendStartEpoch(args.startEpoch);
  const year = Math.floor(weekendStartEpoch / SHOW_YEAR_HOURS) + 1;
  const hourInYear = weekendStartEpoch % SHOW_YEAR_HOURS;
  const weekInYear = Math.floor(hourInYear / SHOW_WEEK_HOURS) + 1;

  return `year-${year}-week-${weekInYear}`;
}
