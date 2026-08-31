import type { ArtCampaignReadDto, ArtCampaignStatusValue } from "@/server/services/artCampaign.service";

import { ART_CAMPAIGN_STATUS_PRESENTATION } from "./artCampaignPresentation";

export type ArtCampaignFilters = {
  groupName: string;
  breedName: string;
  status: "ALL" | ArtCampaignStatusValue;
};

export const DEFAULT_ART_CAMPAIGN_FILTERS: ArtCampaignFilters = {
  groupName: "ALL",
  breedName: "",
  status: "ALL",
};

export const ART_CAMPAIGN_STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All" },
  ...Object.entries(ART_CAMPAIGN_STATUS_PRESENTATION).map(([value, label]) => ({ value: value as ArtCampaignStatusValue, label })),
] as const;

export function getArtCampaignGroupOptions(campaigns: ArtCampaignReadDto[]): string[] {
  return [...new Set(campaigns.map((campaign) => campaign.breedGroupName).filter((groupName): groupName is string => Boolean(groupName)))].sort((left, right) => left.localeCompare(right));
}

export function filterArtCampaigns(campaigns: ArtCampaignReadDto[], filters: ArtCampaignFilters): ArtCampaignReadDto[] {
  const normalizedBreedName = filters.breedName.trim().toLocaleLowerCase();

  return campaigns.filter((campaign) => (
    (filters.groupName === "ALL" || campaign.breedGroupName === filters.groupName) &&
    (filters.status === "ALL" || campaign.status === filters.status) &&
    (!normalizedBreedName || campaign.breedName.toLocaleLowerCase().includes(normalizedBreedName))
  ));
}
