import { db } from "@/lib/db";
import { getCurrentEpoch } from "@/lib/gameClock";
import { seedJudgePanelFromCsv } from "@/server/services/judgePanel.service";
import fs from "node:fs";
import path from "node:path";

const SHOW_BLOCK_FILENAME = "partialshowblock.csv";
const ENTRY_OPEN_LEAD_HOURS = 14;

type ShowBlockCsvRow = {
  showName: string;
  showDateEpoch: number;
  ringNumber: number;
  ringName: string;
  startEpoch: number;
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
  startEpoch: number;
  endEpoch: number;
}) {
  if (args.currentEpoch < args.startEpoch - ENTRY_OPEN_LEAD_HOURS) {
    return "SCHEDULED" as const;
  }

  if (args.currentEpoch <= args.endEpoch) {
    return "OPEN" as const;
  }

  return "CLOSED" as const;
}

function getShowDayStatus(args: {
  currentEpoch: number;
  scheduledEpoch: number;
}) {
  if (args.currentEpoch < args.scheduledEpoch - ENTRY_OPEN_LEAD_HOURS) {
    return "SCHEDULED" as const;
  }

  if (args.currentEpoch < args.scheduledEpoch) {
    return "ENTRY_OPEN" as const;
  }

  return "ENTRY_LOCKED" as const;
}

function getBlockStatus(args: { currentEpoch: number; startEpoch: number }) {
  if (args.currentEpoch < args.startEpoch - ENTRY_OPEN_LEAD_HOURS) {
    return "SCHEDULED" as const;
  }

  if (args.currentEpoch < args.startEpoch) {
    return "ENTRY_OPEN" as const;
  }

  return "ENTRY_LOCKED" as const;
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
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (judges.length === 0) {
    throw new Error("No active judges are available after judge panel seeding.");
  }

  const judgeByName = new Map(
    judges.map((judge) => [normalizeName(judge.name), judge])
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
        entryOpenEpoch: Math.max(0, startEpoch - ENTRY_OPEN_LEAD_HOURS),
        entryCloseEpoch: Math.max(0, startEpoch - 1),
        status: getClusterStatus({ currentEpoch, startEpoch, endEpoch }),
      },
      create: {
        id: clusterId,
        name: firstRow.showName,
        year,
        district: 4,
        startEpoch,
        endEpoch,
        entryOpenEpoch: Math.max(0, startEpoch - ENTRY_OPEN_LEAD_HOURS),
        entryCloseEpoch: Math.max(0, startEpoch - 1),
        status: getClusterStatus({ currentEpoch, startEpoch, endEpoch }),
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
          status: getShowDayStatus({ currentEpoch, scheduledEpoch }),
        },
        create: {
          clusterId,
          scheduledEpoch,
          dayIndex: dateIndex + 1,
          judgeId: fallbackJudge.id,
          status: getShowDayStatus({ currentEpoch, scheduledEpoch }),
        },
        select: { id: true },
      });

      showDayCount += 1;

      for (const [rowIndex, row] of dayRows.entries()) {
        const exactJudge = judgeByName.get(normalizeName(row.judgeName));
        const assignedJudge =
          exactJudge ?? judges[(dateIndex + rowIndex) % judges.length] ?? judges[0];

        if (!exactJudge) {
          warnings.push(
            `Judge "${row.judgeName}" was not found in fulljudgepanel.csv; assigned ${assignedJudge.name}.`
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
            status: getBlockStatus({ currentEpoch, startEpoch: row.startEpoch }),
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
            status: getBlockStatus({ currentEpoch, startEpoch: row.startEpoch }),
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
