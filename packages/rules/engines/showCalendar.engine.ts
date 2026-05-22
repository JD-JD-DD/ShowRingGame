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
import { getHourInYear } from "../src/time";

export type ShowClusterType = "TWO_DAY" | "FOUR_DAY";

export type ShowClusterTemplate = {
  templateId: string;
  name: string;
  type: ShowClusterType;
  weekInYear: number;
  slotIndex: number;
  district: number;
  showDayOffsets: number[];
  showDayNames: string[];
  startDayOffset: number;
  endDayOffset: number;
  entryCloseOffsetHours: number;
  generationHorizonHours: number;
};

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

const DAY_NAME_BY_WEEK_OFFSET: Record<number, string> = {
  0: "Monday",
  4: "Friday",
  5: "Saturday",
  6: "Sunday",
};

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function getWeekStartEpoch(epoch: number): number {
  const yearStartEpoch = Math.floor(epoch / SHOW_YEAR_HOURS) * SHOW_YEAR_HOURS;
  const hourInYear = getHourInYear(epoch);
  const showCalendarHourInYear = Math.min(hourInYear, SHOW_YEAR_HOURS - 2);

  return (
    yearStartEpoch +
    showCalendarHourInYear -
    (showCalendarHourInYear % SHOW_WEEK_HOURS)
  );
}

function getYear(epoch: number): number {
  return Math.floor(epoch / SHOW_YEAR_HOURS) + 1;
}

function getWeekInYear(weekStartEpoch: number): number {
  return Math.floor(getHourInYear(weekStartEpoch) / SHOW_WEEK_HOURS) + 1;
}

function getCalendarWeekIndex(weekStartEpoch: number): number {
  return getWeekInYear(weekStartEpoch) - 1;
}

function isAnnualEventHour(epoch: number): boolean {
  return getHourInYear(epoch) === SHOW_YEAR_HOURS - 1;
}

function getNextWeekStartEpoch(weekStartEpoch: number): number {
  const yearStartEpoch =
    Math.floor(weekStartEpoch / SHOW_YEAR_HOURS) * SHOW_YEAR_HOURS;
  const hourInYear = getHourInYear(weekStartEpoch);
  const nextHourInYear = hourInYear + SHOW_WEEK_HOURS;

  if (nextHourInYear >= SHOW_YEAR_HOURS - 1) {
    return yearStartEpoch + SHOW_YEAR_HOURS;
  }

  return weekStartEpoch + SHOW_WEEK_HOURS;
}

function getShowClusterName(type: ShowClusterType, district: number): string {
  const typeLabel = type === "FOUR_DAY" ? "4-Day" : "2-Day";

  return `District ${district} ${typeLabel} Cluster`;
}

function getShowClusterDayOffsets(type: ShowClusterType): readonly number[] {
  return type === "FOUR_DAY"
    ? FOUR_DAY_CLUSTER_DAY_OFFSETS
    : TWO_DAY_CLUSTER_DAY_OFFSETS;
}

function getDayNames(dayOffsets: readonly number[]): string[] {
  return dayOffsets.map((offset) => DAY_NAME_BY_WEEK_OFFSET[offset] ?? `${offset}`);
}

function csvEscape(value: string | number): string {
  const text = `${value}`;

  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
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

export function generateAnnualShowClusterTemplates(): ShowClusterTemplate[] {
  const weekCount = Math.floor((SHOW_YEAR_HOURS - 1) / SHOW_WEEK_HOURS);
  const templates: ShowClusterTemplate[] = [];

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const weekInYear = weekIndex + 1;

    for (let slotIndex = 0; slotIndex < SHOW_CLUSTERS_PER_WEEK; slotIndex += 1) {
      const type = getShowClusterTypeForSlot({ weekIndex, slotIndex });
      const district = getShowClusterDistrict({ weekIndex, slotIndex });
      const showDayOffsets = [...getShowClusterDayOffsets(type)];

      templates.push({
        templateId: `week-${weekInYear}-slot-${slotIndex + 1}`,
        name: getShowClusterName(type, district),
        type,
        weekInYear,
        slotIndex,
        district,
        showDayOffsets,
        showDayNames: getDayNames(showDayOffsets),
        startDayOffset: Math.min(...showDayOffsets),
        endDayOffset: Math.max(...showDayOffsets),
        entryCloseOffsetHours: SHOW_ENTRY_CLOSE_OFFSET_HOURS,
        generationHorizonHours: SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
      });
    }
  }

  return templates;
}

export function showClusterTemplatesToCsv(
  templates: ShowClusterTemplate[] = generateAnnualShowClusterTemplates()
): string {
  const header = [
    "templateId",
    "weekInYear",
    "slotIndex",
    "district",
    "clusterType",
    "name",
    "showDayOffsets",
    "showDayNames",
    "startDayOffset",
    "endDayOffset",
    "entryCloseOffsetHours",
    "generationHorizonHours",
  ];
  const rows = templates.map((template) => [
    template.templateId,
    template.weekInYear,
    template.slotIndex + 1,
    template.district,
    template.type,
    template.name,
    template.showDayOffsets.join("|"),
    template.showDayNames.join("|"),
    template.startDayOffset,
    template.endDayOffset,
    template.entryCloseOffsetHours,
    template.generationHorizonHours,
  ]);

  return [
    header.join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}

export function generateShowClustersForWeek(
  weekStartEpoch: number
): GeneratedShowCluster[] {
  assertNonNegativeInteger(weekStartEpoch, "weekStartEpoch");

  const normalizedWeekStartEpoch = getWeekStartEpoch(weekStartEpoch);
  const weekIndex = Math.floor(normalizedWeekStartEpoch / SHOW_WEEK_HOURS);
  const year = getYear(normalizedWeekStartEpoch);
  const weekInYear = getWeekInYear(normalizedWeekStartEpoch);
  const calendarWeekIndex = getCalendarWeekIndex(normalizedWeekStartEpoch);

  return Array.from({ length: SHOW_CLUSTERS_PER_WEEK }, (_, slotIndex) => {
    const type = getShowClusterTypeForSlot({
      weekIndex: calendarWeekIndex,
      slotIndex,
    });
    const dayOffsets = getShowClusterDayOffsets(type);
    const showDayEpochs = dayOffsets
      .map((offset) => normalizedWeekStartEpoch + offset)
      .filter((epoch) => !isAnnualEventHour(epoch));
    const startEpoch = Math.min(...showDayEpochs);
    const endEpoch = Math.max(...showDayEpochs);
    const district = getShowClusterDistrict({
      weekIndex: calendarWeekIndex,
      slotIndex,
    });

    return {
      templateId: `week-${weekInYear}-slot-${slotIndex + 1}`,
      name: getShowClusterName(type, district),
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

  for (let weekStartEpoch = startWeek; weekStartEpoch <= endWeek; ) {
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

    weekStartEpoch = getNextWeekStartEpoch(weekStartEpoch);
  }

  return [...clustersByTemplateAndStart.values()].sort(
    (a, b) => a.startEpoch - b.startEpoch || a.district - b.district
  );
}
