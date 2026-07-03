import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const MIGRATION_MAP = [
  { source: "SO", sourceName: "Smooth Collie", target: "OL", targetName: "Collie" },
  { source: "RC", sourceName: "Rough Collie", target: "OL", targetName: "Collie" },
  { source: "QE", sourceName: "American Cocker", target: "QK", targetName: "Cocker Spaniel" },
  { source: "QM", sourceName: "English Cocker", target: "EG", targetName: "English Cocker Spaniel" },
] as const;

const SOURCE_CODES = MIGRATION_MAP.map((mapping) => mapping.source);
const TARGET_CODES = [...new Set(MIGRATION_MAP.map((mapping) => mapping.target))];
const ALL_CODES = [...SOURCE_CODES, ...TARGET_CODES];
const SOURCE_RELEASE_VERSION = 999;
const shouldApply = process.argv.includes("--apply");

function loadDatabaseUrlFromEnvFile() {
  if (process.env.DATABASE_URL) return;

  const cwd = process.cwd();
  for (const candidatePath of [
    join(cwd, ".env"),
    join(cwd, ".env.local"),
    join(cwd, "..", "..", ".env"),
  ]) {
    if (!existsSync(candidatePath)) continue;
    const line = readFileSync(candidatePath, "utf8")
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith("DATABASE_URL="));
    if (!line) continue;
    process.env.DATABASE_URL = line
      .replace(/^DATABASE_URL=/, "")
      .replace(/^"|"$/g, "");
    return;
  }
}

loadDatabaseUrlFromEnvFile();

const db = new PrismaClient();

type ModelUpdater = {
  updateMany: (args: {
    where: { breedCode2: string };
    data: { breedCode2: string };
  }) => Promise<{ count: number }>;
  count: (args: { where: { breedCode2: string } }) => Promise<number>;
};

const BREED_CODE_MODELS: Array<{ label: string; model: ModelUpdater }> = [
  { label: "Dog", model: db.dog },
  { label: "DogPlannerTag", model: db.dogPlannerTag },
  { label: "BreedingAttempt", model: db.breedingAttempt },
  { label: "Litter", model: db.litter },
  { label: "ShowJudgingBlock", model: db.showJudgingBlock },
  { label: "ShowEntry", model: db.showEntry },
  { label: "ShowResult", model: db.showResult },
  { label: "ShowAward", model: db.showAward },
  { label: "DogShowPrestigeCredit", model: db.dogShowPrestigeCredit },
  { label: "DogYearlyPrestigeStat", model: db.dogYearlyPrestigeStat },
];

async function assertTargetBreedsReady() {
  const targetBreeds = await db.breed.findMany({
    where: { code2: { in: TARGET_CODES } },
    select: { code2: true, name: true, isActive: true, releaseVersion: true },
  });
  const byCode = new Map(targetBreeds.map((breed) => [breed.code2, breed]));
  const problems: string[] = [];

  for (const mapping of MIGRATION_MAP) {
    const target = byCode.get(mapping.target);
    if (!target) {
      problems.push(`${mapping.target} ${mapping.targetName} is missing`);
      continue;
    }
    if (!target.isActive) {
      problems.push(`${mapping.target} ${target.name} is not active`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Cannot migrate duplicate breed codes: ${problems.join("; ")}`);
  }
}

async function findLitterCollisions() {
  const litters = await db.litter.findMany({
    where: { breedCode2: { in: ALL_CODES } },
    select: { id: true, breedCode2: true, serial7: true },
  });
  const targetBySource = new Map<string, string>(
    MIGRATION_MAP.map((mapping) => [mapping.source, mapping.target])
  );
  const byTargetSerial = new Map<string, typeof litters>();

  for (const litter of litters) {
    const targetCode = targetBySource.get(litter.breedCode2) ?? litter.breedCode2;
    const key = `${targetCode}:${litter.serial7}`;
    byTargetSerial.set(key, [...(byTargetSerial.get(key) ?? []), litter]);
  }

  return [...byTargetSerial.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      targetSerial: key,
      rows: rows.map((row) => `${row.id}:${row.breedCode2}:${row.serial7}`).join(", "),
    }));
}

async function plannedCounts() {
  const rows: Array<{ source: string; target: string; table: string; count: number }> = [];

  for (const mapping of MIGRATION_MAP) {
    for (const { label, model } of BREED_CODE_MODELS) {
      rows.push({
        source: mapping.source,
        target: mapping.target,
        table: label,
        count: await model.count({ where: { breedCode2: mapping.source } }),
      });
    }
  }

  return rows;
}

async function applyMigration() {
  const mutationCounts: Array<{
    source: string;
    target: string;
    table: string;
    updated: number;
  }> = [];

  for (const mapping of MIGRATION_MAP) {
    await db.$transaction(async (tx) => {
      const txModels: Array<{ label: string; model: ModelUpdater }> = [
        { label: "Dog", model: tx.dog },
        { label: "DogPlannerTag", model: tx.dogPlannerTag },
        { label: "BreedingAttempt", model: tx.breedingAttempt },
        { label: "Litter", model: tx.litter },
        { label: "ShowJudgingBlock", model: tx.showJudgingBlock },
        { label: "ShowEntry", model: tx.showEntry },
        { label: "ShowResult", model: tx.showResult },
        { label: "ShowAward", model: tx.showAward },
        { label: "DogShowPrestigeCredit", model: tx.dogShowPrestigeCredit },
        { label: "DogYearlyPrestigeStat", model: tx.dogYearlyPrestigeStat },
      ];

      for (const { label, model } of txModels) {
        const result = await model.updateMany({
          where: { breedCode2: mapping.source },
          data: { breedCode2: mapping.target },
        });
        mutationCounts.push({
          source: mapping.source,
          target: mapping.target,
          table: label,
          updated: result.count,
        });
      }

      await tx.breed.update({
        where: { code2: mapping.source },
        data: {
          isActive: false,
          releaseVersion: SOURCE_RELEASE_VERSION,
        },
      });
    });
  }

  return mutationCounts;
}

async function main() {
  await assertTargetBreedsReady();

  const collisions = await findLitterCollisions();
  if (collisions.length > 0) {
    console.log("Litter serial collisions would violate @@unique([breedCode2, serial7]):");
    console.table(collisions);
    throw new Error("Duplicate breed migration blocked by litter serial collisions.");
  }

  const plan = await plannedCounts();
  console.log(
    shouldApply
      ? "Apply mode: migrating duplicate breed codes."
      : "Dry run: no database rows will be changed."
  );
  console.table(plan.filter((row) => row.count > 0));

  if (!shouldApply) {
    console.log("Dry run complete. Re-run with --apply to mutate rows.");
    return;
  }

  const mutationCounts = await applyMigration();
  console.log("Rows updated:");
  console.table(mutationCounts.filter((row) => row.updated > 0));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
