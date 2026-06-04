import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { seedJudgePanelFromCsv } from "@/server/services/judgePanel.service";
import {
  CURRENT_BREED_RELEASE,
  SHOW_ENTRY_CLOSE_OFFSET_HOURS,
  SHOW_ENTRY_OPEN_LEAD_HOURS,
  SHOW_INSTANCE_GENERATION_HORIZON_HOURS,
  type GeneratedShowCluster,
  generateShowClustersInHorizon,
} from "@showring/rules";
import fs from "node:fs";
import path from "node:path";

const SHOW_BLOCK_FILENAME = "partialshowblock.csv";
const GENERATED_SHOW_ENTRY_COUNT_HINT = 2;

const TERMINAL_CLUSTER_STATUSES = new Set(["COMPLETE", "CANCELLED"]);
const TERMINAL_DAY_STATUSES = new Set(["RESULTS_PUBLISHED", "CANCELLED"]);
const TERMINAL_BLOCK_STATUSES = new Set(["RESULTS_PUBLISHED", "CANCELLED"]);

type ShowBlockCsvRow = {
  showName: string;
  showDateEpoch: number;
  ringNumber: number;
  ringName: string;
  startEpoch: number;
  judgeCode?: string;
  judgeName: string;
  breedCode2: string;
  breedName: string;
  classType: string;
  entryCount: number;
  blockOrder: number;
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseNumber(value: string, fieldName: string): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid show schedule number for ${fieldName}: ${value}`);
  }

  return parsed;
}

function parseShowBlockCsv(csv: string): ShowBlockCsvRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerLine = lines.shift();

  if (!headerLine) {
    return [];
  }

  const headers = parseCsvLine(headerLine);
  const expectedHeaders = [
    "showName",
    "showDateEpoch",
    "ringNumber",
    "ringName",
    "startEpoch",
    "judgeName",
    "breedCode2",
    "breedName",
    "classType",
    "entryCount",
    "blockOrder",
  ];

  for (const expectedHeader of expectedHeaders) {
    if (!headers.includes(expectedHeader)) {
      throw new Error(`Show schedule is missing column: ${expectedHeader}`);
    }
  }

  return lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""])
    );

    return {
      showName: row.showName,
      showDateEpoch: parseNumber(row.showDateEpoch, "showDateEpoch"),
      ringNumber: parseNumber(row.ringNumber, "ringNumber"),
      ringName: row.ringName,
      startEpoch: parseNumber(row.startEpoch, "startEpoch"),
      judgeCode: row.judgeCode?.trim() || undefined,
      judgeName: row.judgeName,
      breedCode2: row.breedCode2.trim().toUpperCase(),
      breedName: row.breedName,
      classType: row.classType || "REGULAR",
      entryCount: parseNumber(row.entryCount, "entryCount"),
      blockOrder: parseNumber(row.blockOrder, "blockOrder"),
    };
  });
}

function resolveShowBlockPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "docs", SHOW_BLOCK_FILENAME),
    path.resolve(process.cwd(), "..", "..", "docs", SHOW_BLOCK_FILENAME),
  ];
  const existingPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!existingPath) {
    throw new Error(`Could not find docs/${SHOW_BLOCK_FILENAME}.`);
  }

  return existingPath;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getClusterStatus(args: {
  currentEpoch: number;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  endEpoch: number;
}) {
  if (args.currentEpoch < args.entryOpenEpoch) {
    return "SCHEDULED" as const;
  }

  if (args.currentEpoch <= args.entryCloseEpoch) {
    return "OPEN" as const;
  }

  return "CLOSED" as const;
}

function getShowDayStatus(args: {
  currentEpoch: number;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  scheduledEpoch: number;
}) {
  if (args.currentEpoch < args.entryOpenEpoch) {
    return "SCHEDULED" as const;
  }

  if (args.currentEpoch <= args.entryCloseEpoch) {
    return "ENTRY_OPEN" as const;
  }

  return "ENTRY_LOCKED" as const;
}

function getBlockStatus(args: {
  currentEpoch: number;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
}) {
  if (args.currentEpoch < args.entryOpenEpoch) {
    return "SCHEDULED" as const;
  }

  if (args.currentEpoch <= args.entryCloseEpoch) {
    return "ENTRY_OPEN" as const;
  }

  return "ENTRY_LOCKED" as const;
}

function getGeneratedClusterId(cluster: GeneratedShowCluster): string {
  return `generated-year-${cluster.year}-${cluster.templateId}`;
}

function getSeedEntryOpenEpoch(startEpoch: number): number {
  return Math.max(0, startEpoch - SHOW_ENTRY_OPEN_LEAD_HOURS);
}

function getSeedEntryCloseEpoch(startEpoch: number): number {
  return Math.max(0, startEpoch - SHOW_ENTRY_CLOSE_OFFSET_HOURS);
}

async function deleteEmptyGeneratedCluster(clusterId: string): Promise<boolean> {
  const cluster = await db.showCluster.findUnique({
    where: { id: clusterId },
    select: {
      status: true,
      showDays: {
        select: {
          id: true,
          _count: {
            select: {
              showEntries: true,
              showResults: true,
              showAwards: true,
              prestigeCredits: true,
            },
          },
        },
      },
      _count: {
        select: {
          ledgerTransactions: true,
          primaryWeekendPlans: true,
        },
      },
    },
  });

  if (
    !cluster ||
    TERMINAL_CLUSTER_STATUSES.has(cluster.status) ||
    cluster._count.ledgerTransactions > 0 ||
    cluster._count.primaryWeekendPlans > 0 ||
    cluster.showDays.some(
      (showDay) =>
        showDay._count.showEntries > 0 ||
        showDay._count.showResults > 0 ||
        showDay._count.showAwards > 0 ||
        showDay._count.prestigeCredits > 0
    )
  ) {
    return false;
  }

  const showDayIds = cluster.showDays.map((showDay) => showDay.id);

  await db.$transaction(async (tx) => {
    if (showDayIds.length > 0) {
      await tx.showJudgingBlock.deleteMany({
        where: { showDayId: { in: showDayIds } },
      });
      await tx.showDay.deleteMany({
        where: { id: { in: showDayIds } },
      });
    }

    await tx.showCluster.delete({ where: { id: clusterId } });
  });

  return true;
}

function parseGeneratedClusterId(clusterId: string): {
  year: number;
  weekInYear: number;
  slotIndex: number;
} | null {
  const match = clusterId.match(
    /^generated-year-(\d+)-week-(\d+)-slot-(\d+)$/
  );

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    weekInYear: Number(match[2]),
    slotIndex: Number(match[3]) - 1,
  };
}

function normalizeGroupName(groupName: string | null): string {
  return groupName?.trim() || "Other";
}

function groupSortKey(groupName: string): string {
  const match = groupName.match(/\d+/);

  if (match) {
    return match[0].padStart(3, "0");
  }

  return groupName;
}

function getRingName(groupName: string): string {
  return groupName.toLowerCase().includes("ring")
    ? groupName
    : `${groupName} Ring`;
}

function getGeneratedJudgeIndex(args: {
  cluster: GeneratedShowCluster;
  dayIndex: number;
  ringNumber: number;
  blockOrder: number;
  judgeCount: number;
}): number {
  const { cluster, dayIndex, ringNumber, blockOrder, judgeCount } = args;

  return (
    cluster.weekIndex +
    cluster.slotIndex +
    dayIndex +
    ringNumber +
    blockOrder
  ) % judgeCount;
}

async function getReleasedBreedsForShows() {
  return db.breed.findMany({
    where: {
      isActive: true,
      releaseVersion: {
        lte: CURRENT_BREED_RELEASE,
      },
    },
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
    select: {
      code2: true,
      name: true,
      groupName: true,
    },
  });
}

type ReleasedBreedForShows = Awaited<
  ReturnType<typeof getReleasedBreedsForShows>
>[number];

type ActiveJudgeForShows = {
  id: string;
  judgeCode: string;
  name: string;
};

async function getActiveJudgesForShows(): Promise<ActiveJudgeForShows[]> {
  return db.judge.findMany({
    where: { isActive: true },
    orderBy: [{ judgeCode: "asc" }, { name: "asc" }],
    select: { id: true, judgeCode: true, name: true },
  });
}

async function ensureJudgingBlocksForShowDays(args: {
  weekIndex: number;
  slotIndex: number;
  currentEpoch: number;
  entryOpenEpoch: number;
  entryCloseEpoch: number;
  showDays: Array<{
    id: string;
    dayIndex: number;
    scheduledEpoch: number;
  }>;
  breeds: ReleasedBreedForShows[];
  judges: ActiveJudgeForShows[];
}): Promise<number> {
  const {
    weekIndex,
    slotIndex,
    currentEpoch,
    entryOpenEpoch,
    entryCloseEpoch,
    showDays,
    breeds,
    judges,
  } = args;

  const groupNames = [
    ...new Set(breeds.map((breed) => normalizeGroupName(breed.groupName))),
  ].sort(
    (a, b) => groupSortKey(a).localeCompare(groupSortKey(b)) || a.localeCompare(b)
  );
  const ringNumberByGroup = new Map(
    groupNames.map((groupName, index) => [groupName, index + 1])
  );
  let judgingBlockCount = 0;

  for (const showDay of showDays) {
    const blockOrderByRing = new Map<number, number>();

    for (const breed of breeds) {
      const groupName = normalizeGroupName(breed.groupName);
      const ringNumber = ringNumberByGroup.get(groupName) ?? groupNames.length + 1;
      const blockOrder = (blockOrderByRing.get(ringNumber) ?? 0) + 1;
      blockOrderByRing.set(ringNumber, blockOrder);

      const assignedJudge =
        judges[
          getGeneratedJudgeIndex({
            cluster: {
              weekIndex,
              slotIndex,
            } as GeneratedShowCluster,
            dayIndex: showDay.dayIndex,
            ringNumber,
            blockOrder,
            judgeCount: judges.length,
          })
        ];
      const blockStatus = getBlockStatus({
        currentEpoch,
        entryOpenEpoch,
        entryCloseEpoch,
      });
      const existingBlock = await db.showJudgingBlock.findUnique({
        where: {
          showDayId_ringNumber_blockOrder: {
            showDayId: showDay.id,
            ringNumber,
            blockOrder,
          },
        },
        select: { id: true, status: true },
      });

      if (existingBlock) {
        if (!TERMINAL_BLOCK_STATUSES.has(existingBlock.status)) {
          await db.showJudgingBlock.update({
            where: { id: existingBlock.id },
            data: {
              judgeId: assignedJudge.id,
              breedCode2: breed.code2,
              ringName: getRingName(groupName),
              startEpoch: showDay.scheduledEpoch,
              classType: "REGULAR",
              entryCountHint: GENERATED_SHOW_ENTRY_COUNT_HINT,
              status: blockStatus,
            },
          });
        }
      } else {
        await db.showJudgingBlock.create({
          data: {
            showDayId: showDay.id,
            judgeId: assignedJudge.id,
            breedCode2: breed.code2,
            ringNumber,
            ringName: getRingName(groupName),
            startEpoch: showDay.scheduledEpoch,
            classType: "REGULAR",
            blockOrder,
            entryCountHint: GENERATED_SHOW_ENTRY_COUNT_HINT,
            status: blockStatus,
          },
        });
      }

      judgingBlockCount += 1;
    }
  }

  return judgingBlockCount;
}

export async function ensureGeneratedShowSchedule(args?: {
  currentEpoch?: number;
  horizonHours?: number;
  includeJudgingBlocks?: boolean;
}): Promise<{
  clusterCount: number;
  showDayCount: number;
  judgingBlockCount: number;
  generatedThroughEpoch: number;
}> {
  await seedJudgePanelFromCsv();

  const currentEpoch = args?.currentEpoch ?? getCurrentEpoch();
  const includeJudgingBlocks = args?.includeJudgingBlocks ?? true;
  const horizonHours =
    args?.horizonHours ?? SHOW_INSTANCE_GENERATION_HORIZON_HOURS;
  const clusters = generateShowClustersInHorizon({
    currentEpoch,
    horizonHours,
  });
  const generatedClusterIds = new Set(clusters.map(getGeneratedClusterId));
  const obsoleteClusters = await db.showCluster.findMany({
    where: {
      id: {
        startsWith: "generated-year-",
        ...(generatedClusterIds.size > 0
          ? { notIn: [...generatedClusterIds] }
          : {}),
      },
      startEpoch: { lte: currentEpoch + horizonHours },
      endEpoch: { gte: currentEpoch },
    },
    select: { id: true },
  });

  for (const cluster of obsoleteClusters) {
    await deleteEmptyGeneratedCluster(cluster.id);
  }

  const [breeds, judges] = await Promise.all([
    includeJudgingBlocks ? getReleasedBreedsForShows() : Promise.resolve([]),
    getActiveJudgesForShows(),
  ]);

  if (includeJudgingBlocks && breeds.length === 0) {
    throw new Error("No released active breeds are available for show generation.");
  }

  if (judges.length === 0) {
    throw new Error("No active judges are available for show generation.");
  }

  let showDayCount = 0;
  let judgingBlockCount = 0;

  for (const cluster of clusters) {
    const clusterId = getGeneratedClusterId(cluster);
    const showDayEpochs = [...cluster.showDayEpochs].sort((a, b) => a - b);
    const clusterStatus = getClusterStatus({
      currentEpoch,
      entryOpenEpoch: cluster.entryOpenEpoch,
      entryCloseEpoch: cluster.entryCloseEpoch,
      endEpoch: cluster.endEpoch,
    });
    let existingCluster = await db.showCluster.findUnique({
      where: { id: clusterId },
      select: {
        status: true,
        district: true,
        startEpoch: true,
        endEpoch: true,
        entryOpenEpoch: true,
        entryCloseEpoch: true,
        showDays: {
          orderBy: [{ dayIndex: "asc" }],
          select: { scheduledEpoch: true },
        },
      },
    });
    const generatedStructureChanged =
      existingCluster &&
      (existingCluster.district !== cluster.district ||
        existingCluster.startEpoch !== cluster.startEpoch ||
        existingCluster.endEpoch !== cluster.endEpoch ||
        existingCluster.showDays.length !== showDayEpochs.length ||
        existingCluster.showDays.some(
          (showDay, index) => showDay.scheduledEpoch !== showDayEpochs[index]
        ));
    const generatedTimingChanged =
      existingCluster &&
      (existingCluster.entryOpenEpoch !== cluster.entryOpenEpoch ||
        existingCluster.entryCloseEpoch !== cluster.entryCloseEpoch);

    if (generatedStructureChanged) {
      const deleted = await deleteEmptyGeneratedCluster(clusterId);

      if (deleted) {
        existingCluster = null;
      } else {
        continue;
      }
    }

    if (existingCluster) {
      if (
        generatedTimingChanged ||
        !TERMINAL_CLUSTER_STATUSES.has(existingCluster.status)
      ) {
        await db.showCluster.update({
          where: { id: clusterId },
          data: {
            name: cluster.name,
            year: cluster.year,
            district: cluster.district,
            startEpoch: cluster.startEpoch,
            endEpoch: cluster.endEpoch,
            entryOpenEpoch: cluster.entryOpenEpoch,
            entryCloseEpoch: cluster.entryCloseEpoch,
            status: clusterStatus,
          },
        });
      }
    } else {
      await db.showCluster.create({
        data: {
          id: clusterId,
          name: cluster.name,
          year: cluster.year,
          district: cluster.district,
          startEpoch: cluster.startEpoch,
          endEpoch: cluster.endEpoch,
          entryOpenEpoch: cluster.entryOpenEpoch,
          entryCloseEpoch: cluster.entryCloseEpoch,
          status: clusterStatus,
        },
      });
    }

    for (const [dayOffset, scheduledEpoch] of showDayEpochs.entries()) {
      const dayIndex = dayOffset + 1;
      const dayStatus = getShowDayStatus({
        currentEpoch,
        entryOpenEpoch: cluster.entryOpenEpoch,
        entryCloseEpoch: cluster.entryCloseEpoch,
        scheduledEpoch,
      });
      const fallbackJudge = judges[(cluster.weekIndex + dayIndex) % judges.length];
      const existingDay = await db.showDay.findUnique({
        where: {
          clusterId_dayIndex: {
            clusterId,
            dayIndex,
          },
        },
        select: { id: true, status: true },
      });
      let showDayId = existingDay?.id;

      if (existingDay) {
        if (!TERMINAL_DAY_STATUSES.has(existingDay.status)) {
          const updatedDay = await db.showDay.update({
            where: { id: existingDay.id },
            data: {
              scheduledEpoch,
              judgeId: fallbackJudge.id,
              status: dayStatus,
            },
            select: { id: true },
          });
          showDayId = updatedDay.id;
        }
      } else {
        const createdDay = await db.showDay.create({
          data: {
            clusterId,
            scheduledEpoch,
            dayIndex,
            judgeId: fallbackJudge.id,
            status: dayStatus,
          },
          select: { id: true },
        });
        showDayId = createdDay.id;
      }

      if (!showDayId) {
        continue;
      }

      showDayCount += 1;
    }

    if (includeJudgingBlocks) {
      const showDays = await db.showDay.findMany({
        where: { clusterId },
        orderBy: [{ dayIndex: "asc" }],
        select: { id: true, dayIndex: true, scheduledEpoch: true },
      });

      judgingBlockCount += await ensureJudgingBlocksForShowDays({
        weekIndex: cluster.weekIndex,
        slotIndex: cluster.slotIndex,
        currentEpoch,
        entryOpenEpoch: cluster.entryOpenEpoch,
        entryCloseEpoch: cluster.entryCloseEpoch,
        showDays,
        breeds,
        judges,
      });
    }
  }

  return {
    clusterCount: clusters.length,
    showDayCount,
    judgingBlockCount,
    generatedThroughEpoch: clusters.reduce(
      (latestEpoch, cluster) => Math.max(latestEpoch, cluster.endEpoch),
      currentEpoch
    ),
  };
}

export async function ensureGeneratedShowBlocksForCluster(args: {
  showClusterId: string;
  currentEpoch?: number;
}): Promise<{ judgingBlockCount: number }> {
  const parsed = parseGeneratedClusterId(args.showClusterId);

  if (!parsed) {
    return { judgingBlockCount: 0 };
  }

  await seedJudgePanelFromCsv();

  const currentEpoch = args.currentEpoch ?? getCurrentEpoch();
  const [cluster, breeds, judges] = await Promise.all([
    db.showCluster.findUnique({
      where: { id: args.showClusterId },
      include: {
        showDays: {
          orderBy: [{ dayIndex: "asc" }],
          select: { id: true, dayIndex: true, scheduledEpoch: true },
        },
      },
    }),
    getReleasedBreedsForShows(),
    getActiveJudgesForShows(),
  ]);

  if (!cluster || cluster.showDays.length === 0) {
    return { judgingBlockCount: 0 };
  }

  if (breeds.length === 0) {
    throw new Error("No released active breeds are available for show generation.");
  }

  if (judges.length === 0) {
    throw new Error("No active judges are available for show generation.");
  }

  return {
    judgingBlockCount: await ensureJudgingBlocksForShowDays({
      weekIndex: (parsed.year - 1) * 52 + parsed.weekInYear - 1,
      slotIndex: parsed.slotIndex,
      currentEpoch,
      entryOpenEpoch: cluster.entryOpenEpoch,
      entryCloseEpoch: cluster.entryCloseEpoch,
      showDays: cluster.showDays,
      breeds,
      judges,
    }),
  };
}

export async function seedShowScheduleFromCsv(): Promise<{
  sourcePath: string;
  clusterCount: number;
  showDayCount: number;
  judgingBlockCount: number;
  warnings: string[];
}> {
  await seedJudgePanelFromCsv();

  const currentEpoch = getCurrentEpoch();
  const sourcePath = resolveShowBlockPath();
  const rows = parseShowBlockCsv(fs.readFileSync(sourcePath, "utf8"));
  const warnings: string[] = [];

  const breedCodes = [...new Set(rows.map((row) => row.breedCode2))];
  const breeds = await db.breed.findMany({
    where: { code2: { in: breedCodes } },
    select: { code2: true, name: true },
  });
  const breedByCode = new Map(breeds.map((breed) => [breed.code2, breed]));
  const missingBreedCodes = breedCodes.filter((code2) => !breedByCode.has(code2));

  if (missingBreedCodes.length > 0) {
    throw new Error(`Unknown breed code2 values: ${missingBreedCodes.join(", ")}`);
  }

  for (const row of rows) {
    const breed = breedByCode.get(row.breedCode2);

    if (breed && row.breedName && normalizeName(row.breedName) !== normalizeName(breed.name)) {
      warnings.push(
        `Breed code ${row.breedCode2} maps to ${breed.name}; schedule label "${row.breedName}" was ignored.`
      );
    }
  }

  const judges = await db.judge.findMany({
    where: { isActive: true },
    orderBy: [{ judgeCode: "asc" }, { name: "asc" }],
    select: { id: true, judgeCode: true, name: true },
  });

  if (judges.length === 0) {
    throw new Error("No active judges are available after judge panel seeding.");
  }

  const judgeByName = new Map(
    judges.map((judge) => [normalizeName(judge.name), judge])
  );
  const judgeByCode = new Map(
    judges.map((judge) => [judge.judgeCode.toUpperCase(), judge])
  );
  const rowsByCluster = new Map<string, ShowBlockCsvRow[]>();

  for (const row of rows) {
    const key = `${row.showName}::${row.showDateEpoch}`;
    const clusterRows = rowsByCluster.get(key) ?? [];
    clusterRows.push(row);
    rowsByCluster.set(key, clusterRows);
  }

  let showDayCount = 0;
  let judgingBlockCount = 0;

  for (const clusterRows of rowsByCluster.values()) {
    const firstRow = clusterRows[0];

    if (!firstRow) {
      continue;
    }

    const startEpoch = Math.min(...clusterRows.map((row) => row.startEpoch));
    const endEpoch = Math.max(...clusterRows.map((row) => row.startEpoch));
    const clusterId = `seed-${slugify(firstRow.showName)}-${firstRow.showDateEpoch}`;
    const year = Math.floor(firstRow.showDateEpoch / 365) + 1;

    await db.showCluster.upsert({
      where: { id: clusterId },
      update: {
        name: firstRow.showName,
        year,
        district: 4,
        startEpoch,
        endEpoch,
        entryOpenEpoch: getSeedEntryOpenEpoch(startEpoch),
        entryCloseEpoch: getSeedEntryCloseEpoch(startEpoch),
        status: getClusterStatus({
          currentEpoch,
          entryOpenEpoch: getSeedEntryOpenEpoch(startEpoch),
          entryCloseEpoch: getSeedEntryCloseEpoch(startEpoch),
          endEpoch,
        }),
      },
      create: {
        id: clusterId,
        name: firstRow.showName,
        year,
        district: 4,
        startEpoch,
        endEpoch,
        entryOpenEpoch: getSeedEntryOpenEpoch(startEpoch),
        entryCloseEpoch: getSeedEntryCloseEpoch(startEpoch),
        status: getClusterStatus({
          currentEpoch,
          entryOpenEpoch: getSeedEntryOpenEpoch(startEpoch),
          entryCloseEpoch: getSeedEntryCloseEpoch(startEpoch),
          endEpoch,
        }),
      },
    });

    const rowsByDate = new Map<number, ShowBlockCsvRow[]>();

    for (const row of clusterRows) {
      const dayRows = rowsByDate.get(row.showDateEpoch) ?? [];
      dayRows.push(row);
      rowsByDate.set(row.showDateEpoch, dayRows);
    }

    const sortedDates = [...rowsByDate.keys()].sort((a, b) => a - b);

    for (const [dateIndex, showDateEpoch] of sortedDates.entries()) {
      const dayRows = rowsByDate.get(showDateEpoch) ?? [];
      const scheduledEpoch = Math.min(...dayRows.map((row) => row.startEpoch));
      const fallbackJudge = judges[dateIndex % judges.length] ?? judges[0];

      const showDay = await db.showDay.upsert({
        where: {
          clusterId_dayIndex: {
            clusterId,
            dayIndex: dateIndex + 1,
          },
        },
        update: {
          scheduledEpoch,
          judgeId: fallbackJudge.id,
          status: getShowDayStatus({
            currentEpoch,
            entryOpenEpoch: getSeedEntryOpenEpoch(scheduledEpoch),
            entryCloseEpoch: getSeedEntryCloseEpoch(scheduledEpoch),
            scheduledEpoch,
          }),
        },
        create: {
          clusterId,
          scheduledEpoch,
          dayIndex: dateIndex + 1,
          judgeId: fallbackJudge.id,
          status: getShowDayStatus({
            currentEpoch,
            entryOpenEpoch: getSeedEntryOpenEpoch(scheduledEpoch),
            entryCloseEpoch: getSeedEntryCloseEpoch(scheduledEpoch),
            scheduledEpoch,
          }),
        },
        select: { id: true },
      });

      showDayCount += 1;

      for (const [rowIndex, row] of dayRows.entries()) {
        const exactJudge = row.judgeCode
          ? judgeByCode.get(row.judgeCode.toUpperCase())
          : judgeByName.get(normalizeName(row.judgeName));
        const assignedJudge =
          exactJudge ?? judges[(dateIndex + rowIndex) % judges.length] ?? judges[0];

        if (!exactJudge) {
          const judgeLabel = row.judgeCode
            ? `${row.judgeCode} (${row.judgeName})`
            : row.judgeName;
          warnings.push(
            `Judge "${judgeLabel}" was not found in fulljudgepanel.csv; assigned ${assignedJudge.name}.`
          );
        }

        await db.showJudgingBlock.upsert({
          where: {
            showDayId_ringNumber_blockOrder: {
              showDayId: showDay.id,
              ringNumber: row.ringNumber,
              blockOrder: row.blockOrder,
            },
          },
          update: {
            judgeId: assignedJudge.id,
            breedCode2: row.breedCode2,
            ringName: row.ringName || null,
            startEpoch: row.startEpoch,
            classType: row.classType,
            entryCountHint: row.entryCount,
            status: getBlockStatus({
              currentEpoch,
              entryOpenEpoch: getSeedEntryOpenEpoch(row.startEpoch),
              entryCloseEpoch: getSeedEntryCloseEpoch(row.startEpoch),
            }),
          },
          create: {
            showDayId: showDay.id,
            judgeId: assignedJudge.id,
            breedCode2: row.breedCode2,
            ringNumber: row.ringNumber,
            ringName: row.ringName || null,
            startEpoch: row.startEpoch,
            classType: row.classType,
            blockOrder: row.blockOrder,
            entryCountHint: row.entryCount,
            status: getBlockStatus({
              currentEpoch,
              entryOpenEpoch: getSeedEntryOpenEpoch(row.startEpoch),
              entryCloseEpoch: getSeedEntryCloseEpoch(row.startEpoch),
            }),
          },
        });

        judgingBlockCount += 1;
      }
    }
  }

  return {
    sourcePath,
    clusterCount: rowsByCluster.size,
    showDayCount,
    judgingBlockCount,
    warnings: [...new Set(warnings)],
  };
}
