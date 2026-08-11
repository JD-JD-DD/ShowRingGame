import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

const MIGRATIONS = [
  {
    source: "CW",
    sourceName: "Czechoslovakian Wolfdog",
    sourceGroup: "Working",
    target: "VL",
    targetName: "Czechoslovakian Vlciak",
    targetGroup: "Miscellaneous",
  },
  {
    source: "PI",
    sourceName: "Podenco Ibicenco",
    sourceGroup: "Hound",
    target: "IH",
    targetName: "Ibizan Hound",
    targetGroup: "Hound",
  },
] as const;

const shouldApply = process.argv.includes("--apply");

type BreedCodeModel = {
  count: (args: { where: { breedCode2: string } }) => Promise<number>;
  updateMany: (args: {
    where: { breedCode2: string };
    data: { breedCode2: string };
  }) => Promise<{ count: number }>;
};

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
      .replace(/^\"|\"$/g, "");
    return;
  }
}

loadDatabaseUrlFromEnvFile();

const db = new PrismaClient();

const breedCodeModels: Array<[string, BreedCodeModel]> = [
  ["Dog", db.dog],
  ["DogPlannerTag", db.dogPlannerTag],
  ["BreedingAttempt", db.breedingAttempt],
  ["Litter", db.litter],
  ["ShowJudgingBlock", db.showJudgingBlock],
  ["ShowEntry", db.showEntry],
  ["ShowResult", db.showResult],
  ["ShowAward", db.showAward],
  ["DogShowPrestigeCredit", db.dogShowPrestigeCredit],
  ["DogYearlyPrestigeStat", db.dogYearlyPrestigeStat],
];

async function sourceReferenceCounts(source: string) {
  const counts = await Promise.all(
    breedCodeModels.map(async ([label, model]) => ({
      model: label,
      count: await model.count({ where: { breedCode2: source } }),
    }))
  );
  return counts;
}

async function assertPreconditions(migration: (typeof MIGRATIONS)[number]) {
  const [sourceBreed, targetBreed, sourceCounts, sourceLitters, targetLitters] =
    await Promise.all([
      db.breed.findUnique({ where: { code2: migration.source } }),
      db.breed.findUnique({ where: { code2: migration.target } }),
      sourceReferenceCounts(migration.source),
      db.litter.findMany({
        where: { breedCode2: migration.source },
        select: { id: true, serial7: true },
      }),
      db.litter.findMany({
        where: { breedCode2: migration.target },
        select: { id: true, serial7: true },
      }),
    ]);

  if (
    targetBreed?.name !== migration.targetName ||
    targetBreed.groupName !== migration.targetGroup ||
    !targetBreed.isActive
  ) {
    throw new Error(
      `Target ${migration.target} is missing or is not the expected active canonical breed.`
    );
  }

  if (!sourceBreed) {
    const remaining = sourceCounts.filter((row) => row.count > 0);
    if (remaining.length > 0) {
      throw new Error(
        `Source ${migration.source} is absent but still has references: ${remaining
          .map((row) => `${row.model}=${row.count}`)
          .join(", ")}`
      );
    }
    return { alreadyMigrated: true, sourceCounts };
  }

  if (
    sourceBreed.name !== migration.sourceName ||
    sourceBreed.groupName !== migration.sourceGroup
  ) {
    throw new Error(
      `Source ${migration.source} does not match the expected duplicate breed identity.`
    );
  }

  const targetSerials = new Set(targetLitters.map((litter) => litter.serial7));
  const collisions = sourceLitters.filter((litter) => targetSerials.has(litter.serial7));
  if (collisions.length > 0) {
    throw new Error(
      `Litter serial collision for ${migration.source}->${migration.target}: ${collisions
        .map((litter) => `${litter.id}:${litter.serial7}`)
        .join(", ")}`
    );
  }

  return { alreadyMigrated: false, sourceCounts };
}

async function migrateOne(migration: (typeof MIGRATIONS)[number]) {
  const preflight = await assertPreconditions(migration);
  if (preflight.alreadyMigrated) {
    console.log(`${migration.source}->${migration.target}: already migrated.`);
    return [];
  }

  if (!shouldApply) {
    console.log(`${migration.source}->${migration.target}: dry run.`);
    console.table(preflight.sourceCounts);
    return [];
  }

  const updates = await db.$transaction(async (tx) => {
    const models: Array<{ label: string; model: BreedCodeModel }> = [
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

    const results = [];
    for (const { label, model } of models) {
      const updated = await model.updateMany({
        where: { breedCode2: migration.source },
        data: { breedCode2: migration.target },
      });
      results.push({ model: label, updated: updated.count });
    }

    await tx.breed.delete({ where: { code2: migration.source } });
    return results;
  });

  console.log(`${migration.source}->${migration.target}: migrated.`);
  console.table(updates);
  return updates;
}

async function main() {
  console.log(
    shouldApply
      ? "Apply mode: migrating CW->VL and PI->IH."
      : "Dry run: no database rows will be changed. Re-run with --apply to mutate."
  );

  for (const migration of MIGRATIONS) {
    await migrateOne(migration);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
