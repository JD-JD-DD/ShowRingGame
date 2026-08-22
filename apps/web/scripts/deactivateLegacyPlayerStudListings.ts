import { PrismaClient, type Prisma } from "@prisma/client";

import { PLAYER_STUD_LISTING_TYPE } from "../server/services/market.service";

const db = new PrismaClient();
const shouldApply = process.argv.includes("--apply");

const activePlayerStudWhere = {
  listingType: PLAYER_STUD_LISTING_TYPE,
  status: "ACTIVE",
} satisfies Prisma.DogListingWhereInput;

async function countActivePlayerStudListings() {
  return db.dogListing.count({ where: activePlayerStudWhere });
}

async function main() {
  const activePlayerStudBefore = await countActivePlayerStudListings();
  const transitionedToCancelled = shouldApply
    ? (
        await db.dogListing.updateMany({
          where: activePlayerStudWhere,
          data: { status: "CANCELLED" },
        })
      ).count
    : 0;
  const activePlayerStudAfter = await countActivePlayerStudListings();

  console.log(
    JSON.stringify(
      {
        mode: shouldApply ? "apply" : "dry-run",
        activePlayerStudBefore,
        candidateCount: shouldApply ? undefined : activePlayerStudBefore,
        transitionedToCancelled,
        activePlayerStudAfter,
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
