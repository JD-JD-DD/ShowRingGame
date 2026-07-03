import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getCurrentEpoch } from "../lib/gameClock";

function loadDatabaseUrlFromEnvFile() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const cwd = process.cwd();
  const candidatePaths = [
    join(cwd, ".env"),
    join(cwd, ".env.local"),
    join(cwd, "..", "..", ".env"),
  ];

  for (const candidatePath of candidatePaths) {
    if (!existsSync(candidatePath)) {
      continue;
    }

    const line = readFileSync(candidatePath, "utf8")
      .split(/\r?\n/)
      .find((candidate) => candidate.startsWith("DATABASE_URL="));

    if (!line) {
      continue;
    }

    process.env.DATABASE_URL = line
      .replace(/^DATABASE_URL=/, "")
      .replace(/^"|"$/g, "");
    return;
  }
}

loadDatabaseUrlFromEnvFile();

const db = new PrismaClient();

const INACTIVE_DUPLICATE_BREED_CODES = ["SO", "RC", "QE", "QM"] as const;
const FOUNDATION_LISTING_TYPE = "FOUNDATION";
const shouldApply = process.argv.includes("--apply");

type CleanupListing = Awaited<ReturnType<typeof findTargetListings>>[number];

function dogDisplayName(dog: CleanupListing["dog"]): string {
  return dog.registeredName ?? dog.callName ?? dog.regNumber;
}

async function findTargetListings() {
  return db.dogListing.findMany({
    where: {
      sellerType: "SYSTEM",
      listingType: FOUNDATION_LISTING_TYPE,
      status: "ACTIVE",
      dog: {
        breedCode2: {
          in: [...INACTIVE_DUPLICATE_BREED_CODES],
        },
        ownerKennelId: null,
        lifecycleState: "ALIVE",
        marketState: "LISTED_NPC",
        originType: "FOUNDATION",
        isFoundation: true,
      },
    },
    orderBy: [{ dog: { breedCode2: "asc" } }, { listedAtEpoch: "asc" }],
    select: {
      id: true,
      status: true,
      listedAtEpoch: true,
      expiresAtEpoch: true,
      dog: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
          breedCode2: true,
          marketState: true,
          ownerKennelId: true,
          breed: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
}

function printReport(listings: CleanupListing[]) {
  if (listings.length === 0) {
    console.log("No active inactive-breed foundation listings found.");
    return;
  }

  console.table(
    listings.map((listing) => ({
      code2: listing.dog.breedCode2,
      breedName: listing.dog.breed.name,
      dogId: listing.dog.id,
      dogName: dogDisplayName(listing.dog),
      listingId: listing.id,
      status: listing.status,
      proposedAction: "Expire listing and set unowned foundation dog NOT_FOR_SALE",
    }))
  );
}

async function applyCleanup(listings: CleanupListing[], currentEpoch: number) {
  let expiredListings = 0;
  let updatedDogs = 0;

  await db.$transaction(async (tx) => {
    for (const listing of listings) {
      const updateListingResult = await tx.dogListing.updateMany({
        where: {
          id: listing.id,
          sellerType: "SYSTEM",
          listingType: FOUNDATION_LISTING_TYPE,
          status: "ACTIVE",
          dog: {
            id: listing.dog.id,
            breedCode2: {
              in: [...INACTIVE_DUPLICATE_BREED_CODES],
            },
            ownerKennelId: null,
            lifecycleState: "ALIVE",
            marketState: "LISTED_NPC",
            originType: "FOUNDATION",
            isFoundation: true,
          },
        },
        data: {
          status: "EXPIRED",
          expiresAtEpoch: currentEpoch,
        },
      });

      if (updateListingResult.count === 0) {
        continue;
      }

      expiredListings += updateListingResult.count;

      const remainingActiveListings = await tx.dogListing.count({
        where: {
          dogId: listing.dog.id,
          status: "ACTIVE",
        },
      });

      if (remainingActiveListings > 0) {
        continue;
      }

      const updateDogResult = await tx.dog.updateMany({
        where: {
          id: listing.dog.id,
          breedCode2: {
            in: [...INACTIVE_DUPLICATE_BREED_CODES],
          },
          ownerKennelId: null,
          lifecycleState: "ALIVE",
          marketState: "LISTED_NPC",
          originType: "FOUNDATION",
          isFoundation: true,
        },
        data: {
          marketState: "NOT_FOR_SALE",
        },
      });

      updatedDogs += updateDogResult.count;
    }
  });

  return {
    expiredListings,
    updatedDogs,
  };
}

async function countRemainingActiveListings() {
  const rows = await Promise.all(
    INACTIVE_DUPLICATE_BREED_CODES.map(async (code2) => {
      const [activeFoundationListings, playerOwnedDogs] = await Promise.all([
        db.dogListing.count({
          where: {
            sellerType: "SYSTEM",
            listingType: FOUNDATION_LISTING_TYPE,
            status: "ACTIVE",
            dog: {
              breedCode2: code2,
              ownerKennelId: null,
              lifecycleState: "ALIVE",
              marketState: "LISTED_NPC",
              originType: "FOUNDATION",
              isFoundation: true,
            },
          },
        }),
        db.dog.count({
          where: {
            breedCode2: code2,
            ownerKennelId: {
              not: null,
            },
          },
        }),
      ]);

      return {
        code2,
        activeFoundationListings,
        playerOwnedDogs,
      };
    })
  );

  console.table(rows);
  return rows;
}

async function main() {
  const currentEpoch = getCurrentEpoch();
  const listings = await findTargetListings();

  console.log(
    shouldApply
      ? "Apply mode: expiring inactive duplicate breed foundation listings."
      : "Dry run: no database rows will be changed."
  );
  printReport(listings);

  if (shouldApply) {
    const result = await applyCleanup(listings, currentEpoch);
    console.log(
      `Expired ${result.expiredListings} listing(s); updated ${result.updatedDogs} dog(s) to NOT_FOR_SALE.`
    );
  } else {
    console.log(`Would expire ${listings.length} listing(s).`);
  }

  console.log("Remaining active foundation listings by inactive duplicate code:");
  const remainingRows = await countRemainingActiveListings();

  if (
    shouldApply &&
    remainingRows.some((row) => row.activeFoundationListings > 0)
  ) {
    throw new Error(
      "Inactive duplicate breed foundation listings remain after cleanup."
    );
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
