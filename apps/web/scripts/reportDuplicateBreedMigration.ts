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
const FOUNDATION_LISTING_TYPE = "FOUNDATION";
const PLAYER_STUD_LISTING_TYPE = "PLAYER_STUD";

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

async function countByCode(model: {
  count: (args: { where: { breedCode2: string } }) => Promise<number>;
}, code2: string) {
  return model.count({ where: { breedCode2: code2 } });
}

async function buildCodeReport(code2: string) {
  const [
    breed,
    dogs,
    ownedDogs,
    playerOwnedDogs,
    unownedFoundationDogs,
    activeUnownedFoundationDogs,
    litters,
    breedingAttempts,
    showJudgingBlocks,
    showEntries,
    futureEligibleShowEntries,
    showResults,
    showAwards,
    prestigeCredits,
    yearlyPrestigeStats,
    plannerTags,
    marketListings,
    activeMarketListings,
    activeFoundationListings,
    activeStudListings,
    titleProgressRows,
    grandChampionCredits,
  ] = await Promise.all([
    db.breed.findUnique({
      where: { code2 },
      select: { code2: true, name: true, isActive: true, releaseVersion: true },
    }),
    countByCode(db.dog, code2),
    db.dog.count({ where: { breedCode2: code2, ownerKennelId: { not: null } } }),
    db.dog.count({
      where: { breedCode2: code2, ownerKennelId: { not: null }, isFoundation: false },
    }),
    db.dog.count({
      where: { breedCode2: code2, ownerKennelId: null, isFoundation: true },
    }),
    db.dog.count({
      where: {
        breedCode2: code2,
        ownerKennelId: null,
        isFoundation: true,
        marketState: "LISTED_NPC",
        lifecycleState: "ALIVE",
      },
    }),
    countByCode(db.litter, code2),
    countByCode(db.breedingAttempt, code2),
    countByCode(db.showJudgingBlock, code2),
    countByCode(db.showEntry, code2),
    db.showEntry.count({
      where: {
        breedCode2: code2,
        entryStatus: "ENTERED",
        showDay: {
          status: {
            in: ["SCHEDULED", "JUDGING"],
          },
        },
      },
    }),
    countByCode(db.showResult, code2),
    countByCode(db.showAward, code2),
    countByCode(db.dogShowPrestigeCredit, code2),
    countByCode(db.dogYearlyPrestigeStat, code2),
    countByCode(db.dogPlannerTag, code2),
    db.dogListing.count({ where: { dog: { breedCode2: code2 } } }),
    db.dogListing.count({ where: { status: "ACTIVE", dog: { breedCode2: code2 } } }),
    db.dogListing.count({
      where: {
        status: "ACTIVE",
        sellerType: "SYSTEM",
        listingType: FOUNDATION_LISTING_TYPE,
        dog: { breedCode2: code2 },
      },
    }),
    db.dogListing.count({
      where: {
        status: "ACTIVE",
        listingType: PLAYER_STUD_LISTING_TYPE,
        dog: { breedCode2: code2 },
      },
    }),
    db.dogTitleProgress.count({ where: { dog: { breedCode2: code2 } } }),
    db.dogGrandChampionCredit.count({ where: { dog: { breedCode2: code2 } } }),
  ]);

  return {
    code2,
    breedName: breed?.name ?? "(missing)",
    isActive: breed?.isActive ?? null,
    releaseVersion: breed?.releaseVersion ?? null,
    dogs,
    ownedDogs,
    playerOwnedDogs,
    unownedFoundationDogs,
    activeUnownedFoundationDogs,
    litters,
    breedingAttempts,
    showJudgingBlocks,
    showEntries,
    futureEligibleShowEntries,
    showResults,
    showAwards,
    prestigeCredits,
    yearlyPrestigeStats,
    plannerTags,
    marketListings,
    activeMarketListings,
    activeFoundationListings,
    activeStudListings,
    titleProgressRows,
    grandChampionCredits,
  };
}

async function reportLitterCollisions() {
  const litters = await db.litter.findMany({
    where: { breedCode2: { in: ALL_CODES } },
    select: { id: true, breedCode2: true, serial7: true },
    orderBy: [{ breedCode2: "asc" }, { serial7: "asc" }],
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

  const collisions = [...byTargetSerial.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      targetSerial: key,
      rows: rows.map((row) => `${row.id}:${row.breedCode2}:${row.serial7}`).join(", "),
    }));

  console.log("Potential litter unique-key collisions after migration:");
  if (collisions.length === 0) {
    console.log("None.");
  } else {
    console.table(collisions);
  }
}

async function main() {
  console.log("Duplicate breed migration map:");
  console.table(MIGRATION_MAP);

  console.log("Counts by source and target code:");
  console.table(await Promise.all(ALL_CODES.map(buildCodeReport)));

  console.log("Target breed status:");
  console.table(
    await db.breed.findMany({
      where: { code2: { in: TARGET_CODES } },
      orderBy: { code2: "asc" },
      select: { code2: true, name: true, isActive: true, releaseVersion: true },
    })
  );

  await reportLitterCollisions();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
