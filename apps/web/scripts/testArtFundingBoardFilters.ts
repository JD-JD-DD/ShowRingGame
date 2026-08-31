import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ART_CAMPAIGN_STATUS_FILTER_OPTIONS, DEFAULT_ART_CAMPAIGN_FILTERS, filterArtCampaigns, getArtCampaignGroupOptions } from "../lib/artCampaignFilters";
import type { ArtCampaignReadDto } from "../server/services/artCampaign.service";

function campaign(overrides: Partial<ArtCampaignReadDto>): ArtCampaignReadDto {
  return {
    id: overrides.id ?? "campaign",
    campaignKey: "STANDARD_BREED_ARTWORK",
    title: "Standard Breed Artwork",
    breedCode2: "XX",
    breedName: "Example Breed",
    breedGroupName: "Sporting",
    status: "NEEDS_FUNDING",
    artworkAssetReference: null,
    firstSuccessfulContributionAt: null,
    progress: {
      fundingGoalCents: 5000, fundingUnitCents: 500, totalFundingUnits: 10, unitsFunded: 0, unitsRemaining: 10,
      amountFundedCents: 0, amountRemainingCents: 5000, isFullyFunded: false, canAcceptContributions: true,
      minContributionUnits: 1, maxContributionUnits: 10, fundRemainingUnits: 10, isConfigurationValid: true, isStatusProgressConsistent: true,
    },
    ...overrides,
  };
}

function main() {
  const boardClient = readFileSync(join(process.cwd(), "components/art/BreedArtFundingBoardClient.tsx"), "utf8");
  const campaigns = [
    campaign({ id: "a", breedName: "Golden Retriever", breedGroupName: "Sporting", status: "NEEDS_FUNDING" }),
    campaign({ id: "b", breedName: "Labrador Retriever", breedGroupName: "Sporting", status: "FUNDED" }),
    campaign({ id: "c", breedName: "Rough Collie", breedGroupName: "Herding", status: "DRAWING_COMPLETE" }),
  ];

  assert.deepEqual(getArtCampaignGroupOptions(campaigns), ["Herding", "Sporting"]);
  assert.deepEqual(ART_CAMPAIGN_STATUS_FILTER_OPTIONS, [
    { value: "ALL", label: "All" },
    { value: "NEEDS_FUNDING", label: "Needs Funding" },
    { value: "FUNDED", label: "Funded — Awaiting Artwork" },
    { value: "DRAWING_COMPLETE", label: "Drawing Complete" },
  ]);
  assert.deepEqual(filterArtCampaigns(campaigns, DEFAULT_ART_CAMPAIGN_FILTERS).map((item) => item.id), ["a", "b", "c"]);
  assert.deepEqual(filterArtCampaigns(campaigns, { ...DEFAULT_ART_CAMPAIGN_FILTERS, breedName: "  retriever " }).map((item) => item.id), ["a", "b"]);
  assert.deepEqual(filterArtCampaigns(campaigns, { ...DEFAULT_ART_CAMPAIGN_FILTERS, groupName: "Sporting", status: "NEEDS_FUNDING", breedName: "golden" }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterArtCampaigns(campaigns, { ...DEFAULT_ART_CAMPAIGN_FILTERS, status: "FUNDED" }).map((item) => item.id), ["b"]);
  assert.deepEqual(filterArtCampaigns(campaigns, { ...DEFAULT_ART_CAMPAIGN_FILTERS, status: "DRAWING_COMPLETE" }).map((item) => item.id), ["c"]);
  assert.deepEqual(filterArtCampaigns(campaigns, { ...DEFAULT_ART_CAMPAIGN_FILTERS, breedName: "terrier" }), []);
  assert.match(boardClient, /<label[\s\S]*Group[\s\S]*<select/);
  assert.match(boardClient, /<label[\s\S]*Breed Name[\s\S]*type="search"/);
  assert.match(boardClient, /<label[\s\S]*Funding Status[\s\S]*<select/);
  assert.match(boardClient, /<button type="button"[\s\S]*setFilters\(DEFAULT_ART_CAMPAIGN_FILTERS\)[\s\S]*Clear Filters/);
  assert.match(boardClient, /aria-live="polite"[\s\S]*Showing/);
  assert.match(boardClient, /No breeds match these filters\./);
  console.log("ART-05 Breed Art funding board filter checks passed.");
}

main();
