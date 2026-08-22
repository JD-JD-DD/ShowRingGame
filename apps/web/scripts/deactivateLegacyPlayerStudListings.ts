import { PrismaClient, type Prisma } from "@prisma/client";
// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const shouldApply = process.argv.includes("--apply");

async function main() {
  const { PLAYER_STUD_LISTING_TYPE } = await import(
    "../server/services/market.service"
  );
  const activePlayerStudWhere = {
    listingType: PLAYER_STUD_LISTING_TYPE,
    status: "ACTIVE",
  } satisfies Prisma.DogListingWhereInput;
  const countActivePlayerStudListings = () =>
    db.dogListing.count({ where: activePlayerStudWhere });
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
