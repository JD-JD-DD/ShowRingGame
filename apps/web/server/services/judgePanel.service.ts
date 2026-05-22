import { db } from "@/lib/db";
import {
  FULL_JUDGE_PANEL_FILENAME,
  parseJudgeRosterCsv,
} from "@showring/rules";
import fs from "node:fs";
import path from "node:path";

function resolveJudgePanelPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "docs", FULL_JUDGE_PANEL_FILENAME),
    path.resolve(process.cwd(), "..", "..", "docs", FULL_JUDGE_PANEL_FILENAME),
  ];

  const existingPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!existingPath) {
    throw new Error(`Could not find docs/${FULL_JUDGE_PANEL_FILENAME}.`);
  }

  return existingPath;
}

function toJudgeId(judgeName: string): string {
  const normalizedName = judgeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `judge-${normalizedName}`;
}

function toJudgeCode(index: number): string {
  return `JDG-${String(index + 1).padStart(4, "0")}`;
}

function toJudgeIdFromCode(judgeCode: string): string {
  return `judge-${judgeCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export async function seedJudgePanelFromCsv(): Promise<{
  sourcePath: string;
  judgeCount: number;
}> {
  const sourcePath = resolveJudgePanelPath();
  const rows = parseJudgeRosterCsv(fs.readFileSync(sourcePath, "utf8"));

  for (const [index, row] of rows.entries()) {
    const judgeCode = row.judgeCode ?? toJudgeCode(index);
    const legacyJudgeId = toJudgeId(row.judgeName);
    const existingJudgeByCode = await db.judge.findUnique({
      where: { judgeCode },
      select: { id: true },
    });
    const existingJudgeByLegacyId = existingJudgeByCode
      ? null
      : await db.judge.findUnique({
          where: { id: legacyJudgeId },
          select: { id: true },
        });
    const judgeId =
      existingJudgeByCode?.id ??
      existingJudgeByLegacyId?.id ??
      toJudgeIdFromCode(judgeCode);

    await db.judge.upsert({
      where: { id: judgeId },
      update: {
        judgeCode,
        name: row.judgeName,
        style: row.style,
        isActive: true,
        weightTypeExpression: row.typeExpressionWeight,
        weightStructureBalance: row.structureBalanceWeight,
        weightMovement: row.movementWeight,
        weightCoatPresentation: row.coatPresentationWeight,
        weightTemperamentRingBehavior: row.temperamentBehaviorWeight,
        weightConditioningHandling: row.conditioningHandlingWeight,
      },
      create: {
        id: judgeId,
        judgeCode,
        name: row.judgeName,
        style: row.style,
        isActive: true,
        weightTypeExpression: row.typeExpressionWeight,
        weightStructureBalance: row.structureBalanceWeight,
        weightMovement: row.movementWeight,
        weightCoatPresentation: row.coatPresentationWeight,
        weightTemperamentRingBehavior: row.temperamentBehaviorWeight,
        weightConditioningHandling: row.conditioningHandlingWeight,
      },
    });
  }

  return {
    sourcePath,
    judgeCount: rows.length,
  };
}
