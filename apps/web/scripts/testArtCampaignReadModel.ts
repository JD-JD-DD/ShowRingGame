import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  calculateArtCampaignProgress,
  getArtCampaignFundRemaining,
  getStandardBreedArtworkBoardSummary,
  selectHelpFinishArtCampaigns,
  toArtCampaignReadDto,
  validateArtContributionUnits,
} from "../server/services/artCampaign.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const config = { fundingGoalCents: 5000, fundingUnitCents: 500, totalFundingUnits: 10, artistAllocationCents: 4000, showRingAllocationCents: 1000 };
const contribution = (fundedUnits: number, at = "2026-08-01T00:00:00.000Z") => ({ fundedUnits, requestedAt: new Date(at), fundedAt: fundedUnits > 0 ? new Date(at) : null });

function campaign(args: Partial<any> = {}) {
  return toArtCampaignReadDto({
    id: args.id ?? "campaign", campaignKey: args.campaignKey ?? "STANDARD_BREED_ARTWORK", title: args.title ?? "Standard Breed Artwork — Beagle",
    breedCode2: args.breedCode2 ?? "BE", status: args.status ?? "NEEDS_FUNDING", ...config, breed: { name: args.breedName ?? "Beagle", groupName: "Hound" },
    contributions: args.contributions ?? [], artwork: args.artwork ?? null,
  });
}

async function main() {
  const empty = calculateArtCampaignProgress({ status: "NEEDS_FUNDING", config, contributions: [] });
  assert.deepEqual([empty.unitsFunded, empty.unitsRemaining, empty.amountFundedCents, empty.amountRemainingCents], [0, 10, 0, 5000]);
  const one = calculateArtCampaignProgress({ status: "NEEDS_FUNDING", config, contributions: [contribution(1)] });
  assert.deepEqual([one.unitsFunded, one.unitsRemaining, one.amountFundedCents], [1, 9, 500]);
  const several = calculateArtCampaignProgress({ status: "NEEDS_FUNDING", config, contributions: [contribution(2), contribution(3), contribution(0)] });
  assert.equal(several.unitsFunded, 5, "requested-only rows do not fund a campaign");
  const full = calculateArtCampaignProgress({ status: "NEEDS_FUNDING", config, contributions: [contribution(12)] });
  assert.deepEqual([full.unitsFunded, full.unitsRemaining, full.amountFundedCents, full.canAcceptContributions], [10, 0, 5000, false]);
  assert.equal(full.isStatusProgressConsistent, false, "stale NEEDS_FUNDING status fails closed after full funding");
  const malformed = calculateArtCampaignProgress({ status: "NEEDS_FUNDING", config, contributions: [contribution(-2), contribution(99)] });
  assert.deepEqual([malformed.unitsFunded, malformed.unitsRemaining, malformed.amountFundedCents], [10, 0, 5000]);
  const invalid = calculateArtCampaignProgress({ status: "NEEDS_FUNDING", config: { ...config, fundingGoalCents: 1 }, contributions: [] });
  assert.equal(invalid.canAcceptContributions, false, "invalid configuration fails closed");
  assert.equal(calculateArtCampaignProgress({ status: "FUNDED", config, contributions: [contribution(10)] }).canAcceptContributions, false);
  assert.equal(calculateArtCampaignProgress({ status: "DRAWING_COMPLETE", config, contributions: [contribution(10)] }).canAcceptContributions, false);

  assert.deepEqual(validateArtContributionUnits(one, 1), { ok: true, requestedUnits: 1, amountCents: 500 });
  assert.deepEqual(validateArtContributionUnits(one, 9), { ok: true, requestedUnits: 9, amountCents: 4500 });
  assert.equal(validateArtContributionUnits(one, 10).ok, false);
  for (const quantity of [0, -1, 1.5]) assert.equal(validateArtContributionUnits(one, quantity).ok, false);
  assert.deepEqual(getArtCampaignFundRemaining(one), { units: 9, amountCents: 4500 });
  assert.equal(getArtCampaignFundRemaining(full), null);

  const help = selectHelpFinishArtCampaigns([
    campaign({ id: "a", breedName: "Zulu", contributions: [contribution(7, "2026-08-03T00:00:00.000Z")] }),
    campaign({ id: "b", breedName: "Alpha", contributions: [contribution(7, "2026-08-01T00:00:00.000Z")] }),
    campaign({ id: "c", breedName: "Bravo", contributions: [contribution(7, "2026-08-02T00:00:00.000Z")] }),
    campaign({ id: "d", breedName: "Charlie", contributions: [contribution(7, "2026-08-02T00:00:00.000Z")] }),
    campaign({ id: "e", breedName: "Request Only", contributions: [contribution(0, "2026-07-01T00:00:00.000Z"), contribution(7, "2026-08-04T00:00:00.000Z")] }),
    campaign({ id: "f", breedName: "Funded", status: "FUNDED", contributions: [contribution(10)] }),
  ]);
  assert.deepEqual(help.map((item) => item.id), ["b", "c", "d"], "closest funding, real first contribution, then stable fallback determine help order");

  const board = await getStandardBreedArtworkBoardSummary({ database: { artCampaign: { findMany: async ({ where }: any) => {
    assert.deepEqual(where, {
      campaignKey: "STANDARD_BREED_ARTWORK",
      breed: { isActive: true, releaseVersion: { lte: 19 } },
    }, "only eligible standard campaigns are included in board totals");
    return [
    { id: "funded", campaignKey: "STANDARD_BREED_ARTWORK", title: "Funded", breedCode2: "A", status: "FUNDED", ...config, breed: { name: "A", groupName: "Hound" }, contributions: [contribution(10)], artwork: null },
    { id: "complete", campaignKey: "STANDARD_BREED_ARTWORK", title: "Complete", breedCode2: "B", status: "DRAWING_COMPLETE", ...config, breed: { name: "B", groupName: "Hound" }, contributions: [contribution(10)], artwork: { assetReference: "art.png" } },
    ];
  } } } as any });
  assert.deepEqual([board.fundedCampaignCount, board.drawingCompleteCount, board.totalEligibleCampaignCount], [2, 1, 2]);

  const service = source("apps/web/server/services/artCampaign.service.ts");
  assert.match(service, /fundedUnits/);
  assert.doesNotMatch(service, /SupportSubscription|SupportProviderEvent|LedgerTransaction|paypal/i);
  assert.doesNotMatch(service, /\b314\b|\b318\b/);
  assert.match(service, /releaseVersion: \{ lte: CURRENT_BREED_RELEASE \}/);
  console.log("ART-03 Breed Art campaign read-model checks passed.");
}

void main();
