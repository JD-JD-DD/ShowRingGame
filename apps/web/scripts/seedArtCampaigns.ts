// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { CURRENT_BREED_RELEASE } from "@showring/rules";

import {
  STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
  seedInitialStandardBreedArtworkCampaigns,
} from "../prisma/artCampaignSeed";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const RETIRED_DUPLICATE_BREED_CODES = ["SO", "RC", "QE", "QM"] as const;

async function main() {
  const eligibleBreeds = await prisma.breed.findMany({
    where: {
      isActive: true,
      releaseVersion: { lte: CURRENT_BREED_RELEASE },
    },
    select: { code2: true },
  });
  const eligibleBreedCodes = eligibleBreeds.map((breed) => breed.code2);
  const campaignsBefore = await prisma.artCampaign.findMany({
    where: {
      campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
      breedCode2: { in: eligibleBreedCodes },
    },
    select: { breedCode2: true },
  });

  await seedInitialStandardBreedArtworkCampaigns(prisma);

  const [campaignsAfter, retiredCampaigns] = await Promise.all([
    prisma.artCampaign.findMany({
      where: {
        campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
        breedCode2: { in: eligibleBreedCodes },
      },
      select: { breedCode2: true },
    }),
    prisma.artCampaign.findMany({
      where: {
        campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
        breedCode2: { in: [...RETIRED_DUPLICATE_BREED_CODES] },
      },
      select: { breedCode2: true },
    }),
  ]);

  const uniqueCampaignCodes = new Set(campaignsAfter.map((campaign) => campaign.breedCode2));
  const missingEligibleCodes = eligibleBreedCodes.filter((code2) => !uniqueCampaignCodes.has(code2));
  if (campaignsAfter.length !== eligibleBreedCodes.length || missingEligibleCodes.length > 0 || retiredCampaigns.length > 0) {
    throw new Error("Breed Art campaign initialization verification failed.");
  }

  console.log(JSON.stringify({
    eligibleBreedCount: eligibleBreedCodes.length,
    campaignsAlreadyPresent: campaignsBefore.length,
    campaignsCreated: campaignsAfter.length - campaignsBefore.length,
    finalCampaignCount: campaignsAfter.length,
    excludedRetiredBreedCodes: RETIRED_DUPLICATE_BREED_CODES,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Breed Art campaign initialization failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
