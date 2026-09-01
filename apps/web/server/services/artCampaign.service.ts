import { CURRENT_BREED_RELEASE } from "@showring/rules";

import { db } from "@/lib/db";
import { STANDARD_BREED_ARTWORK_CAMPAIGN_KEY } from "@/prisma/artCampaignSeed";

export const ART_CAMPAIGN_STATUSES = ["NEEDS_FUNDING", "FUNDED", "DRAWING_COMPLETE"] as const;
export type ArtCampaignStatusValue = (typeof ART_CAMPAIGN_STATUSES)[number];

export type ArtContributionFundingRecord = {
  fundedUnits: number;
  requestedAt: Date;
  fundedAt: Date | null;
};

type ArtContributionRecognitionRecord = ArtContributionFundingRecord & {
  recognition?: "KENNEL_CREDIT" | "ANONYMOUS";
  kennelId?: string;
  kennel?: { name: string; slug: string };
};

export type ArtCampaignRecognitionDto = {
  supporterCount: number;
  publicKennels: Array<{ kennelName: string; kennelSlug: string }>;
  anonymousSupporterCount: number;
};

export type ArtCampaignFundingConfiguration = {
  fundingGoalCents: number;
  fundingUnitCents: number;
  totalFundingUnits: number;
  artistAllocationCents: number;
  showRingAllocationCents: number;
};

export type ArtCampaignProgress = {
  fundingGoalCents: number;
  fundingUnitCents: number;
  totalFundingUnits: number;
  unitsFunded: number;
  unitsRemaining: number;
  amountFundedCents: number;
  amountRemainingCents: number;
  isFullyFunded: boolean;
  canAcceptContributions: boolean;
  minContributionUnits: number | null;
  maxContributionUnits: number | null;
  fundRemainingUnits: number | null;
  isConfigurationValid: boolean;
  isStatusProgressConsistent: boolean;
};

export type ArtCampaignReadDto = {
  id: string;
  campaignKey: string;
  title: string;
  breedCode2: string;
  breedName: string;
  breedGroupName: string | null;
  status: ArtCampaignStatusValue;
  artworkAssetReference: string | null;
  artworkArtistCredit: string | null;
  artworkCompletedAt: Date | null;
  recognition: ArtCampaignRecognitionDto | null;
  firstSuccessfulContributionAt: Date | null;
  progress: ArtCampaignProgress;
};

export type ArtCampaignBoardSummary = {
  campaigns: ArtCampaignReadDto[];
  fundedCampaignCount: number;
  drawingCompleteCount: number;
  totalEligibleCampaignCount: number;
  helpFinishCampaigns: ArtCampaignReadDto[];
};

export type ArtContributionUnitValidation =
  | { ok: true; requestedUnits: number; amountCents: number }
  | { ok: false; reason: "CAMPAIGN_CLOSED" | "INVALID_UNIT_QUANTITY" | "UNITS_EXCEED_REMAINING" };

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function isArtCampaignFundingConfigurationValid(config: ArtCampaignFundingConfiguration): boolean {
  return (
    isPositiveInteger(config.fundingGoalCents) &&
    isPositiveInteger(config.fundingUnitCents) &&
    isPositiveInteger(config.totalFundingUnits) &&
    Number.isInteger(config.artistAllocationCents) && config.artistAllocationCents >= 0 &&
    Number.isInteger(config.showRingAllocationCents) && config.showRingAllocationCents >= 0 &&
    config.totalFundingUnits * config.fundingUnitCents === config.fundingGoalCents &&
    config.artistAllocationCents + config.showRingAllocationCents === config.fundingGoalCents
  );
}

function normalizedFundedUnits(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function calculateArtCampaignProgress(args: {
  status: ArtCampaignStatusValue;
  config: ArtCampaignFundingConfiguration;
  contributions: ArtContributionFundingRecord[];
}): ArtCampaignProgress {
  const isConfigurationValid = isArtCampaignFundingConfigurationValid(args.config);
  const rawFundedUnits = args.contributions.reduce((total, contribution) => total + normalizedFundedUnits(contribution.fundedUnits), 0);
  const unitsFunded = isConfigurationValid ? Math.min(rawFundedUnits, args.config.totalFundingUnits) : 0;
  const unitsRemaining = isConfigurationValid ? Math.max(0, args.config.totalFundingUnits - unitsFunded) : 0;
  const amountFundedCents = isConfigurationValid ? Math.min(args.config.fundingGoalCents, unitsFunded * args.config.fundingUnitCents) : 0;
  const amountRemainingCents = isConfigurationValid ? Math.max(0, unitsRemaining * args.config.fundingUnitCents) : 0;
  const isFullyFunded = isConfigurationValid && unitsFunded >= args.config.totalFundingUnits;
  const isStatusProgressConsistent = isConfigurationValid && (
    args.status === "NEEDS_FUNDING" ? !isFullyFunded : isFullyFunded
  );
  const canAcceptContributions = isConfigurationValid && isStatusProgressConsistent && args.status === "NEEDS_FUNDING" && unitsRemaining > 0;

  return {
    fundingGoalCents: args.config.fundingGoalCents,
    fundingUnitCents: args.config.fundingUnitCents,
    totalFundingUnits: args.config.totalFundingUnits,
    unitsFunded,
    unitsRemaining,
    amountFundedCents,
    amountRemainingCents,
    isFullyFunded,
    canAcceptContributions,
    minContributionUnits: canAcceptContributions ? 1 : null,
    maxContributionUnits: canAcceptContributions ? unitsRemaining : null,
    fundRemainingUnits: canAcceptContributions ? unitsRemaining : null,
    isConfigurationValid,
    isStatusProgressConsistent,
  };
}

export function validateArtContributionUnits(progress: ArtCampaignProgress, requestedUnits: unknown): ArtContributionUnitValidation {
  if (!progress.canAcceptContributions) return { ok: false, reason: "CAMPAIGN_CLOSED" };
  if (typeof requestedUnits !== "number" || !Number.isInteger(requestedUnits) || requestedUnits < 1) {
    return { ok: false, reason: "INVALID_UNIT_QUANTITY" };
  }
  if (requestedUnits > progress.unitsRemaining) return { ok: false, reason: "UNITS_EXCEED_REMAINING" };
  return { ok: true, requestedUnits, amountCents: requestedUnits * progress.fundingUnitCents };
}

export function getArtCampaignFundRemaining(progress: ArtCampaignProgress): { units: number; amountCents: number } | null {
  return progress.canAcceptContributions && progress.fundRemainingUnits !== null
    ? { units: progress.fundRemainingUnits, amountCents: progress.amountRemainingCents }
    : null;
}

function firstSuccessfulContributionAt(contributions: ArtContributionFundingRecord[]): Date | null {
  const times = contributions
    .filter((contribution) => normalizedFundedUnits(contribution.fundedUnits) > 0)
    .map((contribution) => contribution.fundedAt ?? contribution.requestedAt)
    .filter((value) => !Number.isNaN(value.getTime()));
  return times.length ? new Date(Math.min(...times.map((value) => value.getTime()))) : null;
}

export function deriveArtCampaignRecognition(contributions: ArtContributionRecognitionRecord[]): ArtCampaignRecognitionDto | null {
  const publicKennels = new Map<string, { kennelName: string; kennelSlug: string }>();
  let anonymousSupporterCount = 0;

  for (const contribution of contributions) {
    if (normalizedFundedUnits(contribution.fundedUnits) === 0 || !contribution.fundedAt) continue;
    if (contribution.recognition === "ANONYMOUS") {
      anonymousSupporterCount += 1;
      continue;
    }
    if (contribution.recognition !== "KENNEL_CREDIT" || !contribution.kennelId || !contribution.kennel) continue;
    publicKennels.set(contribution.kennelId, {
      kennelName: contribution.kennel.name,
      kennelSlug: contribution.kennel.slug,
    });
  }

  const namedKennels = [...publicKennels.values()].sort(
    (left, right) => left.kennelName.localeCompare(right.kennelName) || left.kennelSlug.localeCompare(right.kennelSlug)
  );
  const supporterCount = namedKennels.length + anonymousSupporterCount;
  return supporterCount > 0 ? { supporterCount, publicKennels: namedKennels, anonymousSupporterCount } : null;
}

export function toArtCampaignReadDto(campaign: {
  id: string;
  campaignKey: string;
  title: string;
  breedCode2: string;
  status: ArtCampaignStatusValue;
  fundingGoalCents: number;
  fundingUnitCents: number;
  totalFundingUnits: number;
  artistAllocationCents: number;
  showRingAllocationCents: number;
  breed: { name: string; groupName: string | null };
  contributions: ArtContributionRecognitionRecord[];
  artwork: { assetReference: string | null; artistCredit?: string | null; completedAt?: Date | null } | null;
}): ArtCampaignReadDto {
  return {
    id: campaign.id,
    campaignKey: campaign.campaignKey,
    title: campaign.title,
    breedCode2: campaign.breedCode2,
    breedName: campaign.breed.name,
    breedGroupName: campaign.breed.groupName,
    status: campaign.status,
    artworkAssetReference: campaign.artwork?.assetReference ?? null,
    artworkArtistCredit: campaign.artwork?.artistCredit ?? null,
    artworkCompletedAt: campaign.artwork?.completedAt ?? null,
    recognition: ["FUNDED", "DRAWING_COMPLETE"].includes(campaign.status) ? deriveArtCampaignRecognition(campaign.contributions) : null,
    firstSuccessfulContributionAt: firstSuccessfulContributionAt(campaign.contributions),
    progress: calculateArtCampaignProgress({
      status: campaign.status,
      config: campaign,
      contributions: campaign.contributions,
    }),
  };
}

export function selectHelpFinishArtCampaigns(campaigns: ArtCampaignReadDto[], limit = 3): ArtCampaignReadDto[] {
  return campaigns
    .filter((campaign) => campaign.status === "NEEDS_FUNDING" && campaign.progress.canAcceptContributions)
    .sort((left, right) => {
      const remaining = left.progress.unitsRemaining - right.progress.unitsRemaining;
      if (remaining !== 0) return remaining;
      const leftFirst = left.firstSuccessfulContributionAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const rightFirst = right.firstSuccessfulContributionAt?.getTime() ?? Number.POSITIVE_INFINITY;
      if (leftFirst !== rightFirst) return leftFirst - rightFirst;
      return left.breedName.localeCompare(right.breedName) || left.campaignKey.localeCompare(right.campaignKey) || left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

export function selectCompletedStandardBreedArtworkGallery(campaigns: ArtCampaignReadDto[]): ArtCampaignReadDto[] {
  return campaigns
    .filter((campaign) => campaign.campaignKey === STANDARD_BREED_ARTWORK_CAMPAIGN_KEY && campaign.status === "DRAWING_COMPLETE" && Boolean(campaign.artworkAssetReference))
    .sort((left, right) => {
      const completedAt = (right.artworkCompletedAt?.getTime() ?? Number.NEGATIVE_INFINITY) - (left.artworkCompletedAt?.getTime() ?? Number.NEGATIVE_INFINITY);
      return completedAt || left.breedName.localeCompare(right.breedName) || left.id.localeCompare(right.id);
    });
}

export function selectFundedStandardBreedArtworkCampaigns(campaigns: ArtCampaignReadDto[]): ArtCampaignReadDto[] {
  return campaigns
    .filter((campaign) => campaign.campaignKey === STANDARD_BREED_ARTWORK_CAMPAIGN_KEY && campaign.status === "FUNDED")
    .sort((left, right) =>
      (left.breedGroupName ?? "").localeCompare(right.breedGroupName ?? "") ||
      left.breedName.localeCompare(right.breedName) ||
      left.id.localeCompare(right.id)
    );
}

type ArtCampaignReadDatabase = {
  artCampaign: { findMany(args: unknown): Promise<any[]> };
};

export async function getEligibleStandardBreedArtworkCampaigns(args: { database?: ArtCampaignReadDatabase } = {}): Promise<ArtCampaignReadDto[]> {
  const database = args.database ?? (db as unknown as ArtCampaignReadDatabase);
  const campaigns = await database.artCampaign.findMany({
    where: {
      campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY,
      breed: {
        isActive: true,
        releaseVersion: { lte: CURRENT_BREED_RELEASE },
      },
    },
    include: {
      breed: { select: { name: true, groupName: true } },
      contributions: { select: { fundedUnits: true, requestedAt: true, fundedAt: true, recognition: true, kennelId: true, kennel: { select: { name: true, slug: true } } } },
      artwork: { select: { assetReference: true, artistCredit: true, completedAt: true } },
    },
    orderBy: [{ breed: { groupName: "asc" } }, { breed: { name: "asc" } }, { id: "asc" }],
  });
  return campaigns.map(toArtCampaignReadDto);
}

export async function getStandardBreedArtworkBoardSummary(args: { database?: ArtCampaignReadDatabase } = {}): Promise<ArtCampaignBoardSummary> {
  const campaigns = await getEligibleStandardBreedArtworkCampaigns(args);
  return {
    campaigns,
    fundedCampaignCount: campaigns.filter((campaign) => campaign.status === "FUNDED" || campaign.status === "DRAWING_COMPLETE").length,
    drawingCompleteCount: campaigns.filter((campaign) => campaign.status === "DRAWING_COMPLETE").length,
    totalEligibleCampaignCount: campaigns.length,
    helpFinishCampaigns: selectHelpFinishArtCampaigns(campaigns),
  };
}
