import { db } from "@/lib/db";
import { STANDARD_BREED_ARTWORK_CAMPAIGN_KEY } from "@/prisma/artCampaignSeed";
import { calculateArtCampaignProgress } from "@/server/services/artCampaign.service";

type Database = any;

export class ArtworkCompletionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function validateArtistCredit(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new ArtworkCompletionError("Artist credit is required.");
  const artistCredit = value.trim();
  if (artistCredit.length > 160 || /[<>]/.test(artistCredit)) throw new ArtworkCompletionError("Artist credit is invalid.");
  return artistCredit;
}

function validateAssetReference(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new ArtworkCompletionError("Artwork asset reference is required.");
  const assetReference = value.trim();
  if (assetReference.length > 2048 || /^(?:javascript|data):/i.test(assetReference)) throw new ArtworkCompletionError("Artwork asset reference is invalid.");
  if (!(assetReference.startsWith("/") && !assetReference.startsWith("//")) && !/^https?:\/\//i.test(assetReference)) {
    throw new ArtworkCompletionError("Artwork asset reference must be a public URL or site path.");
  }
  return assetReference;
}

export async function listFundedArtCampaigns(args: { database?: Database } = {}) {
  const database = args.database ?? db;
  return database.artCampaign.findMany({
    where: { campaignKey: STANDARD_BREED_ARTWORK_CAMPAIGN_KEY, status: "FUNDED" },
    include: { breed: { select: { name: true, groupName: true } }, contributions: { select: { fundedUnits: true, requestedAt: true, fundedAt: true } }, artwork: { select: { artistCredit: true, assetReference: true, completedAt: true } } },
    orderBy: [{ fundedAt: "asc" }, { breed: { name: "asc" } }, { id: "asc" }],
  });
}

export async function completeArtCampaignArtwork(args: { userId: string; campaignId: string; artistCredit: unknown; assetReference: unknown; database?: Database }) {
  const database = args.database ?? db;
  const admin = await database.user.findUnique({ where: { id: args.userId }, select: { isAdmin: true } });
  if (!admin?.isAdmin) throw new ArtworkCompletionError("You are not authorized to manage Breed Art.", 403);

  return database.$transaction(async (tx: any) => {
    const initial = await tx.artCampaign.findUnique({ where: { id: args.campaignId } });
    if (!initial) throw new ArtworkCompletionError("Artwork campaign was not found.", 404);
    await tx.$queryRaw`SELECT "id" FROM "ArtCampaign" WHERE "id" = ${initial.id} FOR UPDATE`;
    const campaign = await tx.artCampaign.findUnique({
      where: { id: args.campaignId },
      include: { breed: { select: { name: true } }, contributions: { select: { fundedUnits: true, requestedAt: true, fundedAt: true } }, artwork: true },
    });
    if (!campaign) throw new ArtworkCompletionError("Artwork campaign was not found.", 404);
    if (campaign.status === "DRAWING_COMPLETE") return { state: "ALREADY_COMPLETED" as const, breedName: campaign.breed.name };
    if (campaign.status !== "FUNDED") throw new ArtworkCompletionError("This artwork campaign has not been fully funded.", 409);
    const artistCredit = validateArtistCredit(args.artistCredit);
    const assetReference = validateAssetReference(args.assetReference);
    const progress = calculateArtCampaignProgress({ status: campaign.status, config: campaign, contributions: campaign.contributions });
    const completedUnits = campaign.contributions
      .filter((contribution: any) => contribution.fundedAt)
      .reduce((total: number, contribution: any) => total + Math.max(0, Math.floor(contribution.fundedUnits)), 0);
    if (!progress.isFullyFunded || completedUnits !== campaign.totalFundingUnits) throw new ArtworkCompletionError("This artwork campaign has not been fully funded.", 409);
    if (campaign.artwork) throw new ArtworkCompletionError("This artwork campaign already has artwork recorded and requires review.", 409);
    const completedAt = new Date();
    await tx.artArtwork.create({ data: { artCampaignId: campaign.id, artistCredit, assetReference, completedAt } });
    await tx.artCampaign.update({ where: { id: campaign.id }, data: { status: "DRAWING_COMPLETE" } });
    return { state: "COMPLETED" as const, breedName: campaign.breed.name, completedAt };
  });
}
