import {
  FOUR_DAY_CLUSTER_DAY_OFFSETS,
  SHOW_CLUSTERS_PER_WEEK,
  SHOW_DISTRICT_COUNT,
  SHOW_ENTRY_CLOSE_OFFSET_HOURS,
  SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
  SHOW_WEEK_HOURS,
  SHOW_YEAR_HOURS,
  TWO_DAY_CLUSTER_DAY_OFFSETS,
} from "../constants";
import { getHourInWeek, getHourInYear } from "../src/time";

export type ShowClusterType = "TWO_DAY" | "FOUR_DAY";

export type GeneratedShowCluster = {
  templateId: string;
  name: string;
  type: ShowClusterType;
  year: number;
  weekIndex: number;
  weekInYear: number;
  slotIndex: number;
  district: number;
  startEpoch: number;
  endEpoch: number;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  showDayEpochs: number[];
};

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function getWeekStartEpoch(epoch: number): number {
  return epoch - getHourInWeek(epoch);
}

function getYear(epoch: number): number {
  return Math.floor(epoch / SHOW_YEAR_HOURS) + 1;
}

function getWeekInYear(weekStartEpoch: number): number {
  return Math.floor(getHourInYear(weekStartEpoch) / SHOW_WEEK_HOURS) + 1;
}

function isAnnualEventHour(epoch: number): boolean {
  return getHourInYear(epoch) === SHOW_YEAR_HOURS - 1;
}

export function getShowClusterTypeForSlot(args: {
  weekIndex: number;
  slotIndex: number;
}): ShowClusterType {
  const { weekIndex, slotIndex } = args;

  assertNonNegativeInteger(weekIndex, "weekIndex");
  assertNonNegativeInteger(slotIndex, "slotIndex");

  const globalClusterIndex = weekIndex * SHOW_CLUSTERS_PER_WEEK + slotIndex;

  return globalClusterIndex % 4 === 3 ? "FOUR_DAY" : "TWO_DAY";
}

export function getShowClusterDistrict(args: {
  weekIndex: number;
  slotIndex: number;
}): number {
  const { weekIndex, slotIndex } = args;

  assertNonNegativeInteger(weekIndex, "weekIndex");
  assertNonNegativeInteger(slotIndex, "slotIndex");

  return ((weekIndex * SHOW_CLUSTERS_PER_WEEK + slotIndex) % SHOW_DISTRICT_COUNT) + 1;
}

export function generateShowClustersForWeek(
  weekStartEpoch: number
): GeneratedShowCluster[] {
  assertNonNegativeInteger(weekStartEpoch, "weekStartEpoch");

  const normalizedWeekStartEpoch = getWeekStartEpoch(weekStartEpoch);
  const weekIndex = Math.floor(normalizedWeekStartEpoch / SHOW_WEEK_HOURS);
  const year = getYear(normalizedWeekStartEpoch);
  const weekInYear = getWeekInYear(normalizedWeekStartEpoch);

  return Array.from({ length: SHOW_CLUSTERS_PER_WEEK }, (_, slotIndex) => {
    const type = getShowClusterTypeForSlot({ weekIndex, slotIndex });
    const dayOffsets =
      type === "FOUR_DAY"
        ? FOUR_DAY_CLUSTER_DAY_OFFSETS
        : TWO_DAY_CLUSTER_DAY_OFFSETS;
    const showDayEpochs = dayOffsets
      .map((offset) => normalizedWeekStartEpoch + offset)
      .filter((epoch) => !isAnnualEventHour(epoch));
    const startEpoch = Math.min(...showDayEpochs);
    const endEpoch = Math.max(...showDayEpochs);
    const district = getShowClusterDistrict({ weekIndex, slotIndex });
    const typeLabel = type === "FOUR_DAY" ? "4-Day" : "2-Day";

    return {
      templateId: `district-${district}-week-${weekInYear}-slot-${slotIndex + 1}`,
      name: `District ${district} ${typeLabel} Cluster`,
      type,
      year,
      weekIndex,
      weekInYear,
      slotIndex,
      district,
      startEpoch,
      endEpoch,
      entryOpenEpoch: Math.max(0, startEpoch - SHOW_INSTANCE_GENERATION_HORIZON_HOURS),
      entryCloseEpoch: Math.max(0, startEpoch - SHOW_ENTRY_CLOSE_OFFSET_HOURS),
      showDayEpochs,
    };
  }).filter((cluster) => cluster.showDayEpochs.length > 0);
}

export function generateShowClustersInHorizon(args: {
  currentEpoch: number;
  horizonHours?: number;
}): GeneratedShowCluster[] {
  const {
    currentEpoch,
    horizonHours = SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
  } = args;

  assertNonNegativeInteger(currentEpoch, "currentEpoch");
  assertNonNegativeInteger(horizonHours, "horizonHours");

  const startWeek = getWeekStartEpoch(currentEpoch);
  const endWeek = getWeekStartEpoch(currentEpoch + horizonHours);
  const clustersByTemplateAndStart = new Map<string, GeneratedShowCluster>();

  for (
    let weekStartEpoch = startWeek;
    weekStartEpoch <= endWeek;
    weekStartEpoch += SHOW_WEEK_HOURS
  ) {
    for (const cluster of generateShowClustersForWeek(weekStartEpoch)) {
      const inWindow =
        cluster.endEpoch >= currentEpoch &&
        cluster.startEpoch <= currentEpoch + horizonHours;

      if (inWindow) {
        clustersByTemplateAndStart.set(
          `${cluster.templateId}:${cluster.startEpoch}`,
          cluster
        );
      }
    }
  }

  return [...clustersByTemplateAndStart.values()].sort(
    (a, b) => a.startEpoch - b.startEpoch || a.district - b.district
  );
}
