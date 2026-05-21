import type { Judge, JudgeStyle } from "../engines/judge.engine";

export const FULL_JUDGE_PANEL_FILENAME = "fulljudgepanel.csv";

export type JudgeRosterRow = {
  judgeName: string;
  style: string;
  typeExpressionWeight: number;
  structureBalanceWeight: number;
  movementWeight: number;
  coatPresentationWeight: number;
  temperamentBehaviorWeight: number;
  conditioningHandlingWeight: number;
  variance: number;
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
    throw new Error(`Invalid judge roster number for ${fieldName}: ${value}`);
  }

  return parsed;
}

function normalizeHeader(header: string): string {
  return header.trim();
}

export function mapJudgeRosterStyleToJudgeStyle(style: string): JudgeStyle {
  const normalizedStyle = style.trim().toUpperCase();

  switch (normalizedStyle) {
    case "BALANCED":
      return "BALANCED";
    case "TYPE_JUDGE":
    case "TYPE_FOCUSED":
      return "TYPE_FOCUSED";
    case "STRUCTURE_JUDGE":
    case "STRUCTURE_FOCUSED":
      return "STRUCTURE_FOCUSED";
    case "MOVEMENT_SPECIALIST":
    case "MOVEMENT_FOCUSED":
      return "MOVEMENT_FOCUSED";
    case "COAT_SPECIALIST":
    case "PRESENTATION_FOCUSED":
      return "PRESENTATION_FOCUSED";
    case "TEMPERAMENT_FOCUSED":
      return "TEMPERAMENT_FOCUSED";
    case "CONDITIONING_FOCUSED":
      return "PRESENTATION_FOCUSED";
    default:
      return "BALANCED";
  }
}

export function parseJudgeRosterCsv(csv: string): JudgeRosterRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headerLine = lines.shift();

  if (!headerLine) {
    return [];
  }

  const headers = parseCsvLine(headerLine).map(normalizeHeader);
  const expectedHeaders = [
    "judgeName",
    "style",
    "typeExpressionWeight",
    "structureBalanceWeight",
    "movementWeight",
    "coatPresentationWeight",
    "temperamentBehaviorWeight",
    "conditioningHandlingWeight",
    "variance",
  ];

  for (const expectedHeader of expectedHeaders) {
    if (!headers.includes(expectedHeader)) {
      throw new Error(`Judge roster is missing column: ${expectedHeader}`);
    }
  }

  return lines.map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""])
    );

    return {
      judgeName: row.judgeName,
      style: row.style,
      typeExpressionWeight: parseNumber(
        row.typeExpressionWeight,
        "typeExpressionWeight"
      ),
      structureBalanceWeight: parseNumber(
        row.structureBalanceWeight,
        "structureBalanceWeight"
      ),
      movementWeight: parseNumber(row.movementWeight, "movementWeight"),
      coatPresentationWeight: parseNumber(
        row.coatPresentationWeight,
        "coatPresentationWeight"
      ),
      temperamentBehaviorWeight: parseNumber(
        row.temperamentBehaviorWeight,
        "temperamentBehaviorWeight"
      ),
      conditioningHandlingWeight: parseNumber(
        row.conditioningHandlingWeight,
        "conditioningHandlingWeight"
      ),
      variance: parseNumber(row.variance, "variance"),
    };
  });
}

export function judgeRosterRowToJudge(
  row: JudgeRosterRow,
  judgeId: string
): Judge {
  return {
    judgeId,
    name: row.judgeName,
    style: mapJudgeRosterStyleToJudgeStyle(row.style),
    categoryWeights: {
      TYPE_EXPRESSION: row.typeExpressionWeight,
      STRUCTURE_BALANCE: row.structureBalanceWeight,
      MOVEMENT: row.movementWeight,
      COAT_PRESENTATION: row.coatPresentationWeight,
      TEMPERAMENT_RING_BEHAVIOR: row.temperamentBehaviorWeight,
      CONDITIONING_HANDLING: row.conditioningHandlingWeight,
    },
  };
}
