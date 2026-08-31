import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deriveArtCampaignRecognition, toArtCampaignReadDto } from "../server/services/artCampaign.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const card = source("apps/web/components/art/ArtCampaignCard.tsx");
const service = source("apps/web/server/services/artCampaign.service.ts");

const credit = (kennelId: string, name: string, slug: string) => ({ fundedUnits: 1, requestedAt: new Date(), fundedAt: new Date(), recognition: "KENNEL_CREDIT" as const, kennelId, kennel: { name, slug } });
const anonymous = (kennelId: string) => ({ fundedUnits: 1, requestedAt: new Date(), fundedAt: new Date(), recognition: "ANONYMOUS" as const, kennelId, kennel: { name: "Private Kennel", slug: "private-kennel" } });

const recognition = deriveArtCampaignRecognition([
  credit("silver", "SilverOak Kennels", "silveroaks"),
  credit("silver", "SilverOak Kennels", "silveroaks"),
  credit("foxfire", "Foxfire Kennels", "foxfire"),
  anonymous("hidden-one"),
  anonymous("hidden-one"),
]);
assert.deepEqual(recognition, {
  supporterCount: 4,
  publicKennels: [
    { kennelName: "Foxfire Kennels", kennelSlug: "foxfire" },
    { kennelName: "SilverOak Kennels", kennelSlug: "silveroaks" },
  ],
  anonymousSupporterCount: 2,
}, "public kennels deduplicate while anonymous contributions remain individually anonymous");
assert.equal(deriveArtCampaignRecognition([{ ...credit("unfunded", "Unfunded", "unfunded"), fundedAt: null }]), null, "only completed contributions provide recognition");

const campaign = { id: "campaign", campaignKey: "STANDARD_BREED_ARTWORK", title: "Art", breedCode2: "BG", status: "NEEDS_FUNDING" as const, fundingGoalCents: 5000, fundingUnitCents: 500, totalFundingUnits: 10, artistAllocationCents: 4000, showRingAllocationCents: 1000, breed: { name: "Beagle", groupName: "Hound" }, contributions: [credit("silver", "SilverOak Kennels", "silveroaks")], artwork: null };
assert.equal(toArtCampaignReadDto(campaign).recognition, null, "needs-funding campaigns omit permanent recognition");
assert.equal(toArtCampaignReadDto({ ...campaign, status: "FUNDED" }).recognition?.supporterCount, 1, "funded campaigns expose recognition");
assert.equal(toArtCampaignReadDto({ ...campaign, status: "DRAWING_COMPLETE" }).recognition?.supporterCount, 1, "drawing-complete campaigns retain recognition");
assert.match(card, /<details/);
assert.match(card, /<summary/);
assert.match(card, /href=\{`\/kennels\/\$\{kennel\.kennelSlug\}`\}/);
assert.doesNotMatch(card, /amountCents|fundedUnits|requestedUnits|providerPaymentId/);
assert.match(service, /recognition: \["FUNDED", "DRAWING_COMPLETE"\]/);
console.log("ART-09 Breed Art supporter recognition checks passed.");
