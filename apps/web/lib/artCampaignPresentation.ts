import type { ArtCampaignStatusValue } from "@/server/services/artCampaign.service";

export const ART_CAMPAIGN_STATUS_PRESENTATION: Record<ArtCampaignStatusValue, string> = {
  NEEDS_FUNDING: "Needs Funding",
  FUNDED: "Funded — Awaiting Artwork",
  DRAWING_COMPLETE: "Drawing Complete",
};

export function getArtCampaignStatusLabel(status: ArtCampaignStatusValue): string {
  return ART_CAMPAIGN_STATUS_PRESENTATION[status];
}

export function formatArtCurrency(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
