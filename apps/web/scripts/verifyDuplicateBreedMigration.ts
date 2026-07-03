import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { CURRENT_BREED_RELEASE } from "@showring/rules";

const SOURCE_CODES = ["SO", "RC", "QE", "QM"] as const;
const TARGET_CODES = ["OL", "QK", "EG"] as const;
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

async function countSourceReferences() {
  const counts = {
    dogs: await db.dog.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    dogPlannerTags: await db.dogPlannerTag.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    litters: await db.litter.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    breedingAttempts: await db.breedingAttempt.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    showJudgingBlocks: await db.showJudgingBlock.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    showEntries: await db.showEntry.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    futureEligibleShowEntries: await db.showEntry.count({
      where: {
        breedCode2: { in: [...SOURCE_CODES] },
        entryStatus: "ENTERED",
        showDay: {
          status: {
            in: ["SCHEDULED", "JUDGING"],
          },
        },
      },
    }),
    showResults: await db.showResult.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    showAwards: await db.showAward.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    prestigeCredits: await db.dogShowPrestigeCredit.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    yearlyPrestigeStats: await db.dogYearlyPrestigeStat.count({ where: { breedCode2: { in: [...SOURCE_CODES] } } }),
    activeMarketListings: await db.dogListing.count({
      where: { status: "ACTIVE", dog: { breedCode2: { in: [...SOURCE_CODES] } } },
    }),
    activeFoundationListings: await db.dogListing.count({
      where: {
        status: "ACTIVE",
        sellerType: "SYSTEM",
        listingType: FOUNDATION_LISTING_TYPE,
        dog: { breedCode2: { in: [...SOURCE_CODES] } },
      },
    }),
    activeStudListings: await db.dogListing.count({
      where: {
        status: "ACTIVE",
        listingType: PLAYER_STUD_LISTING_TYPE,
        dog: { breedCode2: { in: [...SOURCE_CODES] } },
      },
    }),
  };

  return counts;
}

async function assertBreedStatus() {
  const sourceBreeds = await db.breed.findMany({
    where: { code2: { in: [...SOURCE_CODES] } },
    select: { code2: true, name: true, isActive: true, releaseVersion: true },
    orderBy: { code2: "asc" },
  });
  const targetBreeds = await db.breed.findMany({
    where: { code2: { in: [...TARGET_CODES] } },
    select: { code2: true, name: true, isActive: true, releaseVersion: true },
    orderBy: { code2: "asc" },
  });

  console.log("Source breed status:");
  console.table(sourceBreeds);
  console.log("Target breed status:");
  console.table(targetBreeds);

  const activeSources = sourceBreeds.filter((breed) => breed.isActive);
  const inactiveTargets = targetBreeds.filter((breed) => !breed.isActive);

  if (activeSources.length > 0) {
    throw new Error(`Source breeds still active: ${activeSources.map((breed) => breed.code2).join(", ")}`);
  }
  if (inactiveTargets.length > 0 || targetBreeds.length !== TARGET_CODES.length) {
    throw new Error("One or more target breeds are missing or inactive.");
  }
}

async function assertCatalogVisibility() {
  const catalogBreeds = await db.breed.findMany({
    where: {
      isActive: true,
      releaseVersion: {
        lte: CURRENT_BREED_RELEASE,
      },
    },
    select: { code2: true, name: true },
  });
  const catalogCodes = new Set(catalogBreeds.map((breed) => breed.code2));

  for (const code of SOURCE_CODES) {
    if (catalogCodes.has(code)) {
      throw new Error(`${code} appears in active catalog query.`);
    }
  }
  for (const code of TARGET_CODES) {
    if (!catalogCodes.has(code)) {
      throw new Error(`${code} is missing from active catalog query.`);
    }
  }
}

async function sampleMigratedDogs() {
  const dogs = await db.dog.findMany({
    where: {
      breedCode2: {
        in: [...TARGET_CODES],
      },
      OR: [
        { regNumber: { startsWith: "SO" } },
        { regNumber: { startsWith: "RC" } },
        { regNumber: { startsWith: "QE" } },
        { regNumber: { startsWith: "QM" } },
      ],
    },
    take: 10,
    orderBy: [{ breedCode2: "asc" }, { regNumber: "asc" }],
    select: {
      id: true,
      regNumber: true,
      breedCode2: true,
      ownerKennelId: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      coatCondition: true,
      breed: { select: { name: true } },
      sireId: true,
      damId: true,
      litterId: true,
      showEntries: { select: { id: true }, take: 1 },
      healthTests: { select: { id: true }, take: 1 },
    },
  });

  console.log("Sample migrated dogs retaining profile relations:");
  console.table(
    dogs.map((dog) => ({
      id: dog.id,
      regNumber: dog.regNumber,
      breedCode2: dog.breedCode2,
      breedName: dog.breed.name,
      ownerKennelId: dog.ownerKennelId,
      hasPedigreeLink: Boolean(dog.sireId || dog.damId || dog.litterId),
      hasShowEntry: dog.showEntries.length > 0,
      hasHealthTest: dog.healthTests.length > 0,
    }))
  );
}

async function main() {
  await assertBreedStatus();
  await assertCatalogVisibility();

  const counts = await countSourceReferences();
  console.log("Remaining source-code gameplay references:");
  console.table([counts]);

  const nonZeroCounts = Object.entries(counts).filter(([, count]) => count > 0);
  if (nonZeroCounts.length > 0) {
    throw new Error(
      `Duplicate source breed codes still referenced: ${nonZeroCounts
        .map(([key, count]) => `${key}=${count}`)
        .join(", ")}`
    );
  }

  await sampleMigratedDogs();
  console.log("Duplicate breed migration verification passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
