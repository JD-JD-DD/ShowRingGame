import { CURRENT_BREED_RELEASE } from "@showring/rules";

export const STANDARD_BREED_ARTWORK_CAMPAIGN_KEY = "STANDARD_BREED_ARTWORK";

export const STANDARD_BREED_ARTWORK_FUNDING = {
  fundingGoalCents: 5000,
  fundingUnitCents: 500,
  totalFundingUnits: 10,
  artistAllocationCents: 4000,
  showRingAllocationCents: 1000,
} as const;

type ArtCampaignSeedDatabase = {
  breed: {
    findMany(args: unknown): Promise<Array<{ code2: string; name: string }>>;
  };
  artCampaign: {
    upsert(args: unknown): Promise<unknown>;
  };
};

/** Seeds missing initial campaigns without rewriting existing campaign progress. */
export async function seedInitialStandardBreedArtworkCampaigns(database: ArtCampaignSeedDatabase): Promise<void> {
  const breeds = await database.breed.findMany({
    where: {
      isActive: true,
      releaseVersion: {
        lte: CURRENT_BREED_RELEASE,
      },
    },
    select: {
      code2: true,
      name: true,
    },
    orderBy: {
      code2: "asc",
    },
  });

  for (const breed of breeds) {
    await database.artCampaign.upsert({
      where: {
        breedCode2_campaignKey: {
          breedCode2: breed.code2,
          campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
        },
      },
      create: {
        breedCode2: breed.code2,
        campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
        title: `Standard Breed Artwork — ${breed.name}`,
        ...STANDARD_BREED_ARTWORK_FUNDING,
      },
      update: {},
    });
  }
}
