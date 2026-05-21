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

export async function seedJudgePanelFromCsv(): Promise<{
  sourcePath: string;
  judgeCount: number;
}> {
  const sourcePath = resolveJudgePanelPath();
  const rows = parseJudgeRosterCsv(fs.readFileSync(sourcePath, "utf8"));

  for (const row of rows) {
    await db.judge.upsert({
      where: { id: toJudgeId(row.judgeName) },
      update: {
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
        id: toJudgeId(row.judgeName),
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
