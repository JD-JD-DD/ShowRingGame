import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { selectCompletedStandardBreedArtworkGallery } from "../server/services/artCampaign.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const gallery = source("apps/web/components/art/CompletedArtworkGallery.tsx");
const page = source("apps/web/app/breed-art/page.tsx");
const card = source("apps/web/components/art/ArtCampaignCard.tsx");

const campaign = (overrides: Record<string, unknown> = {}) => ({ id: "campaign", campaignKey: "STANDARD_BREED_ARTWORK", title: "Art", breedCode2: "BE", breedName: "Beagle", breedGroupName: "Hound", status: "DRAWING_COMPLETE" as const, artworkAssetReference: "beagle.png", artworkArtistCredit: "Jane Artist", artworkCompletedAt: new Date("2026-08-01T00:00:00.000Z"), recognition: { supporterCount: 1, publicKennels: [{ kennelName: "SilverOak Kennels", kennelSlug: "silveroaks" }], anonymousSupporterCount: 0 }, firstSuccessfulContributionAt: null, progress: {} as any, ...overrides });

assert.deepEqual(
  selectCompletedStandardBreedArtworkGallery([
    campaign({ id: "older", breedName: "Zulu", artworkCompletedAt: new Date("2026-08-01T00:00:00.000Z") }),
    campaign({ id: "newer", breedName: "Alpha", artworkCompletedAt: new Date("2026-08-02T00:00:00.000Z") }),
    campaign({ id: "missing", artworkAssetReference: null }),
    campaign({ id: "funded", status: "FUNDED" }),
    campaign({ id: "other", campaignKey: "HOLIDAY_ARTWORK" }),
  ] as any).map((item) => item.id),
  ["newer", "older"],
  "gallery includes only completed standard artwork with usable assets, newest first"
);
assert.match(gallery, /<details/);
assert.match(gallery, /<summary/);
assert.match(gallery, /new Intl\.DateTimeFormat/);
assert.match(gallery, /artwork by/);
assert.match(gallery, /campaign\.recognition/);
assert.match(gallery, /href=\{`\/kennels\/\$\{kennel\.kennelSlug\}`\}/);
assert.doesNotMatch(gallery, /amountCents|fundedUnits|providerPaymentId|ArtContribution/);
assert.match(page, /selectCompletedStandardBreedArtworkGallery/);
assert.match(card, /campaign\.status === "DRAWING_COMPLETE" && campaign\.artworkAssetReference/);
console.log("ART-10 completed artwork gallery checks passed.");
