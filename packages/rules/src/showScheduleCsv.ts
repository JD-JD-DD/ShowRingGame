import fs from "node:fs";

export type AnnualShowClusterType = "TWO_DAY" | "FOUR_DAY" | "RESERVED";

export type AnnualShowScheduleRow = {
  weekInYear: number;
  slotIndex: number | null;
  templateId: string;
  district: number | null;
  showName: string;
  clusterType: AnnualShowClusterType;
  showDayOffsets: number[];
  showDayNames: string[];
  startDayOffset: number | null;
  endDayOffset: number | null;
  entryOpenLeadHours: number;
  entryCloseOffsetHours: number;
  isRegularCircuit: boolean;
  isInvitationalReserved: boolean;
  notes: string;
};

export type AnnualShowScheduleValidationResult = {
  regularRows: AnnualShowScheduleRow[];
  reservedRows: AnnualShowScheduleRow[];
};

const REQUIRED_HEADERS = [
  "weekInYear",
  "slotIndex",
  "templateId",
  "district",
  "showName",
  "clusterType",
  "showDayOffsets",
  "showDayNames",
  "startDayOffset",
  "endDayOffset",
  "entryOpenLeadHours",
  "entryCloseOffsetHours",
  "isRegularCircuit",
  "isInvitationalReserved",
  "notes",
] as const;

const CIRCUIT_COLUMNS = [
  [1, 6, 11],
  [2, 7, 12],
  [3, 8, 13],
  [4, 9, 14],
  [5, 10, 15],
] as const;

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

function parseInteger(
  value: string,
  fieldName: string,
  options: { nullable?: boolean } = {}
): number | null {
  if (!value.trim()) {
    if (options.nullable) {
      return null;
    }

    throw new Error(`${fieldName} is required.`);
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  return parsed;
}

function parseBoolean(value: string, fieldName: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new Error(`${fieldName} must be true or false.`);
}

function parsePipeSeparatedIntegers(value: string, fieldName: string): number[] {
  if (!value.trim()) {
    return [];
  }

  return value.split("|").map((part) => {
    const parsed = Number(part.trim());

    if (!Number.isInteger(parsed)) {
      throw new Error(`${fieldName} must contain pipe-separated integers.`);
    }

    return parsed;
  });
}

function parsePipeSeparatedStrings(value: string): string[] {
  if (!value.trim()) {
    return [];
  }

  return value.split("|").map((part) => part.trim());
}

function parseClusterType(value: string): AnnualShowClusterType {
  const normalized = value.trim();

  if (
    normalized === "TWO_DAY" ||
    normalized === "FOUR_DAY" ||
    normalized === "RESERVED"
  ) {
    return normalized;
  }

  throw new Error(`clusterType must be TWO_DAY, FOUR_DAY, or RESERVED.`);
}

function rowLabel(row: AnnualShowScheduleRow): string {
  return row.templateId || `week ${row.weekInYear}`;
}

function addError(errors: string[], row: AnnualShowScheduleRow, message: string) {
  errors.push(`${rowLabel(row)}: ${message}`);
}

function assertNoErrors(errors: string[]): void {
  if (errors.length > 0) {
    throw new Error(`Invalid annual show schedule CSV:\n${errors.join("\n")}`);
  }
}

export function parseAnnualShowScheduleCsv(
  csv: string
): AnnualShowScheduleRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerLine = lines.shift();

  if (!headerLine) {
    return [];
  }

  const headers = parseCsvLine(headerLine);

  for (const requiredHeader of REQUIRED_HEADERS) {
    if (!headers.includes(requiredHeader)) {
      throw new Error(`Annual show schedule is missing column: ${requiredHeader}`);
    }
  }

  return lines.map((line, index) => {
    const values = parseCsvLine(line);
    const raw = Object.fromEntries(
      headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""])
    );
    const lineNumber = index + 2;

    try {
      return {
        weekInYear: parseInteger(raw.weekInYear, "weekInYear") ?? 0,
        slotIndex: parseInteger(raw.slotIndex, "slotIndex", { nullable: true }),
        templateId: raw.templateId.trim(),
        district: parseInteger(raw.district, "district", { nullable: true }),
        showName: raw.showName.trim(),
        clusterType: parseClusterType(raw.clusterType),
        showDayOffsets: parsePipeSeparatedIntegers(
          raw.showDayOffsets,
          "showDayOffsets"
        ),
        showDayNames: parsePipeSeparatedStrings(raw.showDayNames),
        startDayOffset: parseInteger(raw.startDayOffset, "startDayOffset", {
          nullable: true,
        }),
        endDayOffset: parseInteger(raw.endDayOffset, "endDayOffset", {
          nullable: true,
        }),
        entryOpenLeadHours:
          parseInteger(raw.entryOpenLeadHours, "entryOpenLeadHours") ?? 0,
        entryCloseOffsetHours:
          parseInteger(raw.entryCloseOffsetHours, "entryCloseOffsetHours") ?? 0,
        isRegularCircuit: parseBoolean(
          raw.isRegularCircuit,
          "isRegularCircuit"
        ),
        isInvitationalReserved: parseBoolean(
          raw.isInvitationalReserved,
          "isInvitationalReserved"
        ),
        notes: raw.notes.trim(),
      };
    } catch (error) {
      throw new Error(
        `Could not parse annual show schedule row ${lineNumber}: ${
          error instanceof Error ? error.message : "Unknown error."
        }`
      );
    }
  });
}

export function loadAnnualShowScheduleCsvFile(
  filePath: string
): AnnualShowScheduleRow[] {
  return parseAnnualShowScheduleCsv(fs.readFileSync(filePath, "utf8"));
}

export function validateAnnualShowScheduleRows(
  rows: AnnualShowScheduleRow[]
): AnnualShowScheduleValidationResult {
  const errors: string[] = [];
  const templateIds = new Set<string>();
  const regularRows = rows.filter((row) => row.isRegularCircuit);
  const reservedRows = rows.filter((row) => row.isInvitationalReserved);

  for (const row of rows) {
    if (templateIds.has(row.templateId)) {
      addError(errors, row, "templateId must be unique.");
    }
    templateIds.add(row.templateId);

    if (row.weekInYear < 1 || row.weekInYear > 52) {
      addError(errors, row, "weekInYear must be between 1 and 52.");
    }

    if (row.isRegularCircuit && row.isInvitationalReserved) {
      addError(errors, row, "row cannot be both regular and reserved.");
    }

    if (row.isRegularCircuit) {
      if (row.weekInYear === 52) {
        addError(errors, row, "Week 52 cannot contain regular rows.");
      }

      if (row.slotIndex == null || row.slotIndex < 1 || row.slotIndex > 3) {
        addError(errors, row, "slotIndex must be 1, 2, or 3 for regular rows.");
      }

      if (row.district == null || row.district < 1 || row.district > 15) {
        addError(errors, row, "district must be 1 through 15 for regular rows.");
      }

      if (!row.showName) {
        addError(errors, row, "showName is required for regular rows.");
      }

      if (row.clusterType !== "TWO_DAY" && row.clusterType !== "FOUR_DAY") {
        addError(errors, row, "clusterType must be TWO_DAY or FOUR_DAY.");
      }

      if (row.slotIndex != null) {
        const expectedTemplateId = `week-${row.weekInYear}-slot-${row.slotIndex}`;

        if (row.templateId !== expectedTemplateId) {
          addError(errors, row, `templateId must be ${expectedTemplateId}.`);
        }
      }

      const expectedOffsetCount = row.clusterType === "FOUR_DAY" ? 4 : 2;

      if (row.showDayOffsets.length !== expectedOffsetCount) {
        addError(
          errors,
          row,
          `${row.clusterType} rows must have ${expectedOffsetCount} showDayOffsets.`
        );
      }

      if (row.showDayNames.length !== expectedOffsetCount) {
        addError(
          errors,
          row,
          `${row.clusterType} rows must have ${expectedOffsetCount} showDayNames.`
        );
      }
    }
  }

  if (regularRows.length !== 153) {
    errors.push(`regular annual cluster count must be 153, got ${regularRows.length}.`);
  }

  const week52RegularRows = regularRows.filter((row) => row.weekInYear === 52);

  if (week52RegularRows.length !== 0) {
    errors.push("Week 52 must have zero regular rows.");
  }

  if (!reservedRows.some((row) => row.weekInYear === 52)) {
    errors.push("Week 52 reserved marker row is required.");
  }

  for (let week = 1; week <= 51; week += 1) {
    const rowsForWeek = regularRows
      .filter((row) => row.weekInYear === week)
      .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

    if (rowsForWeek.length !== 3) {
      errors.push(`Week ${week} must have exactly 3 regular rows.`);
      continue;
    }

    const expectedDistricts = CIRCUIT_COLUMNS[(week - 1) % CIRCUIT_COLUMNS.length];
    const districts = rowsForWeek.map((row) => row.district);

    if (districts.join(",") !== expectedDistricts.join(",")) {
      errors.push(
        `Week ${week} districts must be ${expectedDistricts.join(",")}, got ${districts.join(",")}.`
      );
    }
  }

  const districtCounts = new Map<number, number>();
  const fourDayCountByDistrict = new Map<number, number>();

  for (const row of regularRows) {
    if (row.district == null) {
      continue;
    }

    districtCounts.set(row.district, (districtCounts.get(row.district) ?? 0) + 1);

    if (row.clusterType === "FOUR_DAY") {
      fourDayCountByDistrict.set(
        row.district,
        (fourDayCountByDistrict.get(row.district) ?? 0) + 1
      );
    }
  }

  for (let district = 1; district <= 15; district += 1) {
    const expectedCount = district === 1 || district === 6 || district === 11
      ? 11
      : 10;
    const actualCount = districtCounts.get(district) ?? 0;

    if (actualCount !== expectedCount) {
      errors.push(
        `District ${district} must appear ${expectedCount} times, got ${actualCount}.`
      );
    }

    const fourDayCount = fourDayCountByDistrict.get(district) ?? 0;

    if (fourDayCount !== 2) {
      errors.push(
        `District ${district} must have 2 FOUR_DAY rows, got ${fourDayCount}.`
      );
    }
  }

  const fourDayRows = regularRows.filter((row) => row.clusterType === "FOUR_DAY");

  if (fourDayRows.length !== 30) {
    errors.push(`FOUR_DAY regular row count must be 30, got ${fourDayRows.length}.`);
  }

  assertNoErrors(errors);

  return {
    regularRows,
    reservedRows,
  };
}
