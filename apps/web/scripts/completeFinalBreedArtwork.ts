// @ts-expect-error Next provides this runtime package without a declaration entrypoint.
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { STANDARD_BREED_ARTWORK_CAMPAIGN_KEY } from "../prisma/artCampaignSeed";
import { completeArtCampaignArtwork } from "../server/services/artworkCompletion.service";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const artistCredit =
  "PublicReign / On Discord at https://discord.com/users/768273753570148412";
const completions = [
  { breedCode2: "AF", assetReference: "/breed-art/Afghan_Final .jpg" },
  { breedCode2: "BX", assetReference: "/breed-art/Boxer_Final.jpg" },
  { breedCode2: "CO", assetReference: "/breed-art/Chow_Final.jpg" },
] as const;

async function main() {
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("Breed Art completion requires an administrator.");

  for (const completion of completions) {
    const campaign = await prisma.artCampaign.findUnique({
      where: {
        breedCode2_campaignKey: {
          breedCode2: completion.breedCode2,
          campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
        },
      },
      select: {
        id: true,
        status: true,
        artwork: { select: { id: true } },
      },
    });
    if (!campaign) {
      throw new Error(`Missing ${completion.breedCode2} Breed Art campaign.`);
    }
    if (campaign.status !== "FUNDED" || campaign.artwork) {
      throw new Error(
        `${completion.breedCode2} must be FUNDED with no existing artwork before completion.`
      );
    }

    const result = await completeArtCampaignArtwork({
      userId: admin.id,
      campaignId: campaign.id,
      artistCredit,
      assetReference: completion.assetReference,
    });
    if (result.state !== "COMPLETED") {
      throw new Error(`${completion.breedCode2} artwork was not completed.`);
    }
  }

  const completed = await prisma.artCampaign.findMany({
    where: {
      campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
      breedCode2: { in: completions.map((completion) => completion.breedCode2) },
    },
    select: {
      breedCode2: true,
      status: true,
      artwork: {
        select: { assetReference: true, artistCredit: true, completedAt: true },
      },
    },
    orderBy: { breedCode2: "asc" },
  });
  console.log(JSON.stringify(completed, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Breed Art completion failed."
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
