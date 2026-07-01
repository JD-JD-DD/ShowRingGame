import fs from "node:fs";
import path from "node:path";

import {
  SHOW_ENTRY_CLOSE_OFFSET_HOURS,
  SHOW_ENTRY_OPEN_LEAD_HOURS,
  SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
  SHOW_WEEK_HOURS,
  SHOW_YEAR_HOURS,
  type GeneratedShowCluster,
  type ShowClusterTemplate,
  generateAnnualShowClusterTemplates,
  generateShowClustersInHorizon,
} from "@showring/rules";

import {
  parseAnnualShowScheduleCsv,
  validateAnnualShowScheduleRows,
  type AnnualShowScheduleRow,
} from "../../../../packages/rules/src/showScheduleCsv";

export const FIXED_SHOW_SCHEDULE_START_YEAR = 13;

export type RuntimeGeneratedShowCluster = GeneratedShowCluster & {
  generatedClusterId?: string;
  scheduleSource: "legacy" | "fixed";
};

export type RuntimeShowClusterTemplate = ShowClusterTemplate & {
  scheduleSource: "legacy" | "fixed";
};

const FIXED_GENERATED_REGULAR_CLUSTER_ID =
  /^generated-year-(\d+)-fixed-week-(\d+)-slot-(\d+)$/;
const LEGACY_GENERATED_REGULAR_CLUSTER_ID =
  /^generated-year-(\d+)-week-(\d+)-slot-(\d+)$/;
const LEGACY_YEAR_13_REPAIR_CLUSTER_ID =
  /^generated-year-13-week-\d+-slot-\d+$/;

let cachedAnnualSchedule:
  | {
      regularRows: AnnualShowScheduleRow[];
      reservedRows: AnnualShowScheduleRow[];
    }
  | null = null;

function resolveAnnualScheduleCsvPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "docs", "annual-show-schedule.csv"),
    path.resolve(process.cwd(), "..", "..", "docs", "annual-show-schedule.csv"),
  ];
  const existingPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!existingPath) {
    throw new Error("Could not find docs/annual-show-schedule.csv.");
  }

  return existingPath;
}

export function usesFixedAnnualShowSchedule(year: number): boolean {
  return year >= FIXED_SHOW_SCHEDULE_START_YEAR;
}

export function getFixedGeneratedShowClusterId(args: {
  year: number;
  weekInYear: number;
  slotIndex: number;
}): string {
  return `generated-year-${args.year}-fixed-week-${args.weekInYear}-slot-${args.slotIndex}`;
}

export function getRuntimeGeneratedShowClusterId(
  cluster: Pick<RuntimeGeneratedShowCluster, "generatedClusterId" | "year" | "templateId">
): string {
  return cluster.generatedClusterId ?? `generated-year-${cluster.year}-${cluster.templateId}`;
}

export function getGeneratedRegularTemplateId(clusterId: string): string | null {
  const match =
    clusterId.match(LEGACY_GENERATED_REGULAR_CLUSTER_ID) ??
    clusterId.match(FIXED_GENERATED_REGULAR_CLUSTER_ID);

  if (!match) {
    return null;
  }

  return `week-${match[2]}-slot-${match[3]}`;
}

export function isFixedGeneratedRegularShowClusterId(
  clusterId: string | null | undefined
): boolean {
  return Boolean(clusterId?.match(FIXED_GENERATED_REGULAR_CLUSTER_ID));
}

export function isArchivedYear13LegacyRepairCluster(cluster: {
  id: string;
  status?: string | null;
}): boolean {
  return (
    cluster.status === "CANCELLED" &&
    LEGACY_YEAR_13_REPAIR_CLUSTER_ID.test(cluster.id)
  );
}

export function loadValidatedAnnualShowSchedule(): {
  regularRows: AnnualShowScheduleRow[];
  reservedRows: AnnualShowScheduleRow[];
} {
  if (cachedAnnualSchedule) {
    return cachedAnnualSchedule;
  }

  const rows = parseAnnualShowScheduleCsv(
    fs.readFileSync(resolveAnnualScheduleCsvPath(), "utf8")
  );
  cachedAnnualSchedule = validateAnnualShowScheduleRows(rows);

  return cachedAnnualSchedule;
}

function regularRowToTemplate(row: AnnualShowScheduleRow): RuntimeShowClusterTemplate {
  if (row.slotIndex == null || row.district == null) {
    throw new Error(`Invalid regular annual show schedule row: ${row.templateId}.`);
  }

  if (row.clusterType !== "TWO_DAY" && row.clusterType !== "FOUR_DAY") {
    throw new Error(`Invalid regular annual show cluster type: ${row.templateId}.`);
  }

  return {
    templateId: row.templateId,
    name: row.showName,
    type: row.clusterType,
    weekInYear: row.weekInYear,
    slotIndex: row.slotIndex - 1,
    district: row.district,
    showDayOffsets: row.showDayOffsets,
    showDayNames: row.showDayNames,
    startDayOffset: row.startDayOffset ?? Math.min(...row.showDayOffsets),
    endDayOffset: row.endDayOffset ?? Math.max(...row.showDayOffsets),
    entryOpenLeadHours: row.entryOpenLeadHours,
    entryCloseOffsetHours: row.entryCloseOffsetHours,
    generationHorizonHours: SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
    scheduleSource: "fixed",
  };
}

export function getAnnualShowCalendarTemplatesForYear(
  year: number
): RuntimeShowClusterTemplate[] {
  if (!usesFixedAnnualShowSchedule(year)) {
    return generateAnnualShowClusterTemplates().map((template) => ({
      ...template,
      scheduleSource: "legacy" as const,
    }));
  }

  return loadValidatedAnnualShowSchedule().regularRows.map(regularRowToTemplate);
}

function getYear(epoch: number): number {
  return Math.floor(epoch / SHOW_YEAR_HOURS) + 1;
}

function getWeekStartEpoch(year: number, weekInYear: number): number {
  return (year - 1) * SHOW_YEAR_HOURS + (weekInYear - 1) * SHOW_WEEK_HOURS;
}

function fixedRowToGeneratedCluster(args: {
  row: AnnualShowScheduleRow;
  year: number;
}): RuntimeGeneratedShowCluster {
  const template = regularRowToTemplate(args.row);
  const weekStartEpoch = getWeekStartEpoch(args.year, args.row.weekInYear);
  const showDayEpochs = args.row.showDayOffsets.map(
    (dayOffset) => weekStartEpoch + dayOffset
  );
  const startEpoch =
    weekStartEpoch +
    (args.row.startDayOffset ?? Math.min(...args.row.showDayOffsets));
  const endEpoch =
    weekStartEpoch +
    (args.row.endDayOffset ?? Math.max(...args.row.showDayOffsets));

  return {
    templateId: args.row.templateId,
    name: args.row.showName,
    type: template.type,
    year: args.year,
    weekIndex: Math.floor(weekStartEpoch / SHOW_WEEK_HOURS),
    weekInYear: args.row.weekInYear,
    slotIndex: template.slotIndex,
    district: template.district,
    startEpoch,
    endEpoch,
    entryOpenEpoch: Math.max(
      0,
      startEpoch - (args.row.entryOpenLeadHours ?? SHOW_ENTRY_OPEN_LEAD_HOURS)
    ),
    entryCloseEpoch: Math.max(
      0,
      startEpoch - (args.row.entryCloseOffsetHours ?? SHOW_ENTRY_CLOSE_OFFSET_HOURS)
    ),
    showDayEpochs,
    generatedClusterId: getFixedGeneratedShowClusterId({
      year: args.year,
      weekInYear: args.row.weekInYear,
      slotIndex: template.slotIndex + 1,
    }),
    scheduleSource: "fixed",
  };
}

export function generateFixedShowClustersForYear(year: number): RuntimeGeneratedShowCluster[] {
  return loadValidatedAnnualShowSchedule().regularRows
    .map((row) => fixedRowToGeneratedCluster({ row, year }))
    .sort((a, b) => a.startEpoch - b.startEpoch || a.district - b.district);
}

export function generateShowClustersInHorizonForScheduleSources(args: {
  currentEpoch: number;
  horizonHours?: number;
}): RuntimeGeneratedShowCluster[] {
  const horizonHours =
    args.horizonHours ?? SHOW_INSTANCE_GENERATION_HORIZON_HOURS;
  const windowEndEpoch = args.currentEpoch + horizonHours;
  const legacyClusters = generateShowClustersInHorizon(args)
    .filter((cluster) => !usesFixedAnnualShowSchedule(cluster.year))
    .map((cluster) => ({
      ...cluster,
      scheduleSource: "legacy" as const,
    }));
  const startYear = Math.max(
    FIXED_SHOW_SCHEDULE_START_YEAR,
    getYear(args.currentEpoch)
  );
  const endYear = Math.max(
    FIXED_SHOW_SCHEDULE_START_YEAR,
    getYear(windowEndEpoch)
  );
  const fixedClusters: RuntimeGeneratedShowCluster[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    fixedClusters.push(
      ...generateFixedShowClustersForYear(year).filter(
        (cluster) =>
          cluster.endEpoch >= args.currentEpoch &&
          cluster.startEpoch <= windowEndEpoch
      )
    );
  }

  return [...legacyClusters, ...fixedClusters].sort(
    (a, b) => a.startEpoch - b.startEpoch || a.district - b.district
  );
}

export function getWeek51RegularClusterIdsForYear(year: number): string[] {
  if (!usesFixedAnnualShowSchedule(year)) {
    return generateAnnualShowClusterTemplates()
      .filter((template) => template.weekInYear === 51)
      .map((template) => `generated-year-${year}-${template.templateId}`);
  }

  return loadValidatedAnnualShowSchedule()
    .regularRows.filter((row) => row.weekInYear === 51 && row.slotIndex != null)
    .map((row) =>
      getFixedGeneratedShowClusterId({
        year,
        weekInYear: row.weekInYear,
        slotIndex: row.slotIndex ?? 0,
      })
    );
}
