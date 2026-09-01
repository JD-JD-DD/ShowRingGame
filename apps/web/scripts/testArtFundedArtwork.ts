import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { selectFundedStandardBreedArtworkCampaigns } from "../server/services/artCampaign.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const campaign = (overrides: Record<string, unknown> = {}) => ({
  id: "campaign", campaignKey: "STANDARD_BREED_ARTWORK", title: "Art", breedCode2: "BE", breedName: "Beagle", breedGroupName: "Hound",
  status: "FUNDED" as const, artworkAssetReference: null, artworkArtistCredit: null, artworkCompletedAt: null,
  recognition: { supporterCount: 1, publicKennels: [{ kennelName: "SilverOak Kennels", kennelSlug: "silveroaks" }], anonymousSupporterCount: 0 },
  firstSuccessfulContributionAt: new Date("2026-08-31T00:00:00.000Z"),
  progress: { amountFundedCents: 5000, fundingGoalCents: 5000, canAcceptContributions: false }, ...overrides,
});

assert.deepEqual(
  selectFundedStandardBreedArtworkCampaigns([
    campaign({ id: "z", breedName: "Zulu", breedGroupName: "Working" }),
    campaign({ id: "a", breedName: "Alpha", breedGroupName: "Hound" }),
    campaign({ id: "needs", status: "NEEDS_FUNDING" }),
    campaign({ id: "complete", status: "DRAWING_COMPLETE", artworkAssetReference: "complete.png" }),
    campaign({ id: "other", campaignKey: "HOLIDAY_ARTWORK" }),
  ] as any).map((item) => item.id),
  ["a", "z"],
  "funded artwork includes only funded standard campaigns in deterministic group and breed order"
);

const page = source("apps/web/app/breed-art/page.tsx");
const fundedArtwork = source("apps/web/components/art/FundedArtwork.tsx");
const card = source("apps/web/components/art/ArtCampaignCard.tsx");
const board = source("apps/web/components/art/BreedArtFundingBoardClient.tsx");

assert.match(page, /<BreedArtFundingBoardClient[\s\S]*<FundedArtwork[\s\S]*<CompletedArtworkGallery/);
assert.match(page, /selectFundedStandardBreedArtworkCampaigns\(summary\.campaigns\)/);
assert.match(fundedArtwork, /Funded Artwork/);
assert.match(fundedArtwork, /No funded artwork is currently awaiting completion\./);
assert.match(fundedArtwork, /<ArtCampaignCard key=\{campaign\.id\} campaign=\{campaign\}/);
assert.doesNotMatch(fundedArtwork, /ArtCampaignContributionForm|<img/);
assert.match(card, /campaign\.recognition/);
assert.match(card, /campaign\.status === "NEEDS_FUNDING" && progress\.canAcceptContributions/);
assert.match(card, /campaign\.status === "DRAWING_COMPLETE" && artworkAssetReference/);
assert.match(board, /const visibleCampaigns = hasActiveFilters \? filteredCampaigns : \[\]/);
assert.doesNotMatch(page + fundedArtwork, /PayPal|ArtPaymentAttempt|ArtContribution|fetch\(/);
console.log("Funded Artwork lifecycle read-model checks passed.");
