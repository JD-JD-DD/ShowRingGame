import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
  STANDARD_BREED_ARTWORK_FUNDING,
  seedInitialStandardBreedArtworkCampaigns,
} from "../prisma/artCampaignSeed";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

type Campaign = {
  breedCode2: string;
  campaignKey: string;
  title: string;
  status: string;
  fundedAt: Date | null;
  artworkMarker: string | null;
  fundingGoalCents: number;
  fundingUnitCents: number;
  totalFundingUnits: number;
  artistAllocationCents: number;
  showRingAllocationCents: number;
};

function fixtureDatabase() {
  const campaigns = new Map<string, Campaign>();
  const breeds = [
    { code2: "OL", name: "Collie" },
    { code2: "QK", name: "Cocker Spaniel" },
  ];
  const database = {
    breed: {
      findMany: async ({ where }: any) => {
        assert.deepEqual(where, {
          isActive: true,
          releaseVersion: { lte: 19 },
        });
        return breeds;
      },
    },
    artCampaign: {
      upsert: async ({ where, create, update }: any) => {
        const key = `${where.breedCode2_campaignKey.breedCode2}:${where.breedCode2_campaignKey.campaignKey}`;
        const existing = campaigns.get(key);
        if (existing) {
          assert.deepEqual(update, {}, "seed must not reset existing campaign state");
          return existing;
        }
        const campaign: Campaign = {
          ...create,
          status: "NEEDS_FUNDING",
          fundedAt: null,
          artworkMarker: null,
        };
        campaigns.set(key, campaign);
        return campaign;
      },
    },
  };
  return { database, campaigns };
}

async function main() {
  assert.deepEqual(STANDARD_BREED_ARTWORK_FUNDING, {
    fundingGoalCents: 5000,
    fundingUnitCents: 500,
    totalFundingUnits: 10,
    artistAllocationCents: 4000,
    showRingAllocationCents: 1000,
  });

  const fixture = fixtureDatabase();
  await seedInitialStandardBreedArtworkCampaigns(fixture.database);
  assert.equal(fixture.campaigns.size, 2, "one standard campaign is created per eligible breed");
  assert.equal(fixture.campaigns.has(`SO:${STANDARD_BREED_ARTWORK_CAMPAIGN_KEY}`), false, "retired SO is not seeded");
  assert.equal(fixture.campaigns.has(`RC:${STANDARD_BREED_ARTWORK_CAMPAIGN_KEY}`), false, "retired RC is not seeded");
  assert.equal(fixture.campaigns.has(`QE:${STANDARD_BREED_ARTWORK_CAMPAIGN_KEY}`), false, "retired QE is not seeded");
  assert.equal(fixture.campaigns.has(`QM:${STANDARD_BREED_ARTWORK_CAMPAIGN_KEY}`), false, "retired QM is not seeded");

  const collie = fixture.campaigns.get(`OL:${STANDARD_BREED_ARTWORK_CAMPAIGN_KEY}`)!;
  collie.status = "FUNDED";
  collie.fundedAt = new Date("2026-08-31T00:00:00.000Z");
  collie.artworkMarker = "final-artwork";
  await seedInitialStandardBreedArtworkCampaigns(fixture.database);
  assert.equal(fixture.campaigns.size, 2, "rerunning seed does not duplicate campaigns");
  assert.equal(collie.status, "FUNDED", "rerunning seed preserves campaign status");
  assert.equal(collie.fundedAt?.toISOString(), "2026-08-31T00:00:00.000Z", "rerunning seed preserves funding progress");
  assert.equal(collie.artworkMarker, "final-artwork", "rerunning seed preserves artwork data");

  fixture.campaigns.set("OL:HOLIDAY_ART", { ...collie, campaignKey: "HOLIDAY_ART", title: "Collie Holiday Art" });
  assert.equal(fixture.campaigns.size, 3, "a distinct future campaign key can coexist for the same breed");

  const schema = source("apps/web/prisma/schema.prisma");
  const seed = source("apps/web/prisma/artCampaignSeed.ts");
  const migration = source("apps/web/prisma/migrations/20260831120000_add_art_campaign_data_foundation/migration.sql");
  assert.match(schema, /enum ArtCampaignStatus[\s\S]*NEEDS_FUNDING[\s\S]*FUNDED[\s\S]*DRAWING_COMPLETE/);
  assert.match(schema, /enum ArtContributionRecognition[\s\S]*KENNEL_CREDIT[\s\S]*ANONYMOUS/);
  assert.match(schema, /model ArtCampaign[\s\S]*@@unique\(\[breedCode2, campaignKey\]\)/);
  assert.match(schema, /model ArtCampaign[\s\S]*breed\s+Breed\s+@relation\(fields: \[breedCode2\], references: \[code2\]\)/);
  assert.match(schema, /model ArtArtwork[\s\S]*artCampaignId\s+String\s+@unique/);
  assert.match(schema, /model ArtContribution[\s\S]*recognition\s+ArtContributionRecognition/);
  assert.doesNotMatch(schema, /publicCredit|creditText|SupportSubscription.*ArtContribution|SupportProviderEvent.*ArtContribution/);
  assert.match(seed, /isActive: true/);
  assert.match(seed, /releaseVersion:\s*\{\s*lte: CURRENT_BREED_RELEASE/);
  assert.doesNotMatch(seed, /\b314\b|\b318\b/);
  assert.match(seed, /update: \{\}/, "existing seeds must not write mutable defaults");
  assert.match(migration, /ArtCampaign_breedCode2_fkey[\s\S]*REFERENCES "Breed"\("code2"\)/);
  assert.match(migration, /ArtArtwork_artCampaignId_key/);
  console.log("ART-02 Breed Art campaign foundation checks passed.");
}

void main();
