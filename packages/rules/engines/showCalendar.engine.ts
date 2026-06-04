import {
  FOUR_DAY_CLUSTER_DAY_OFFSETS,
  SHOW_CLUSTERS_PER_DISTRICT_PER_YEAR,
  SHOW_CLUSTERS_PER_WEEK,
  SHOW_DISTRICT_COUNT,
  SHOW_ENTRY_OPEN_LEAD_HOURS,
  SHOW_ENTRY_CLOSE_OFFSET_HOURS,
  SHOW_FOUR_DAY_CLUSTERS_PER_DISTRICT_PER_YEAR,
  SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
  SHOW_REDUCED_CLUSTER_WEEK_INTERVAL,
  SHOW_REGULAR_WEEK_COUNT,
  SHOW_WEEK_HOURS,
  SHOW_YEAR_HOURS,
  TWO_DAY_CLUSTER_DAY_OFFSETS,
} from "../constants";
import { getShowDistrictRegion } from "../src/geography";
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
  entryOpenLeadHours: number;
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
  const region = getShowDistrictRegion(district);
  const suffixes =
    type === "FOUR_DAY"
      ? ["Four-Day Classic", "Circuit", "Cluster", "Show Weekend"]
      : ["Weekend Classic", "Kennel Club Weekend", "Show Cluster", "Circuit"];
  const suffix = suffixes[(district - 1) % suffixes.length];

  return `${region.shortName} ${suffix}`;
}

function getShowClusterDayOffsets(type: ShowClusterType): readonly number[] {
  return type === "FOUR_DAY"
    ? FOUR_DAY_CLUSTER_DAY_OFFSETS
    : TWO_DAY_CLUSTER_DAY_OFFSETS;
}

function getDayNames(dayOffsets: readonly number[]): string[] {
  return dayOffsets.map((offset) => DAY_NAME_BY_WEEK_OFFSET[offset] ?? `${offset}`);
}

function getShowSlotIndexesForWeek(weekIndex: number): number[] {
  if (weekIndex >= SHOW_REGULAR_WEEK_COUNT) {
    return [];
  }

  const reducedWeek =
    (weekIndex + 1) % SHOW_REDUCED_CLUSTER_WEEK_INTERVAL === 0;

  return Array.from({ length: SHOW_CLUSTERS_PER_WEEK }, (_, slotIndex) => slotIndex)
    .filter((slotIndex) => !reducedWeek || slotIndex < SHOW_CLUSTERS_PER_WEEK - 1);
}

function getAnnualClusterIndex(args: {
  weekIndex: number;
  slotIndex: number;
}): number {
  const { weekIndex, slotIndex } = args;
  const slotIndexes = getShowSlotIndexesForWeek(weekIndex);

  if (!slotIndexes.includes(slotIndex)) {
    throw new Error("No regular district show is scheduled for that slot.");
  }

  const reducedWeeksBefore = Math.floor(
    weekIndex / SHOW_REDUCED_CLUSTER_WEEK_INTERVAL
  );

  return weekIndex * SHOW_CLUSTERS_PER_WEEK - reducedWeeksBefore + slotIndex;
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

  const annualClusterIndex = getAnnualClusterIndex({ weekIndex, slotIndex });
  const district = (annualClusterIndex % SHOW_DISTRICT_COUNT) + 1;
  const districtVisitIndex = Math.floor(
    annualClusterIndex / SHOW_DISTRICT_COUNT
  );
  const fourDayInterval =
    SHOW_CLUSTERS_PER_DISTRICT_PER_YEAR /
    SHOW_FOUR_DAY_CLUSTERS_PER_DISTRICT_PER_YEAR;

  return (district - 1 + districtVisitIndex) % fourDayInterval === 0
    ? "FOUR_DAY"
    : "TWO_DAY";
}

export function getShowClusterDistrict(args: {
  weekIndex: number;
  slotIndex: number;
}): number {
  const { weekIndex, slotIndex } = args;

  assertNonNegativeInteger(weekIndex, "weekIndex");
  assertNonNegativeInteger(slotIndex, "slotIndex");

  return (getAnnualClusterIndex({ weekIndex, slotIndex }) % SHOW_DISTRICT_COUNT) + 1;
}

export function generateAnnualShowClusterTemplates(): ShowClusterTemplate[] {
  const templates: ShowClusterTemplate[] = [];

  for (let weekIndex = 0; weekIndex < SHOW_REGULAR_WEEK_COUNT; weekIndex += 1) {
    const weekInYear = weekIndex + 1;

    for (const slotIndex of getShowSlotIndexesForWeek(weekIndex)) {
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
        entryOpenLeadHours: SHOW_ENTRY_OPEN_LEAD_HOURS,
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
    "entryOpenLeadHours",
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
    template.entryOpenLeadHours,
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

  return getShowSlotIndexesForWeek(calendarWeekIndex).map((slotIndex) => {
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
      entryOpenEpoch: Math.max(0, startEpoch - SHOW_ENTRY_OPEN_LEAD_HOURS),
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
