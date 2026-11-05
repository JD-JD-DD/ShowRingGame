import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { selectCompletedStandardBreedArtworkGallery } from "../server/services/artCampaign.service";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const gallery = source("apps/web/components/art/CompletedArtworkGallery.tsx");
const page = source("apps/web/app/breed-art/page.tsx");
const card = source("apps/web/components/art/ArtCampaignCard.tsx");
const completionScript = source("apps/web/scripts/completeFinalBreedArtwork.ts");
const dogProfile = source("apps/web/app/dogs/[dogId]/page.tsx");

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
assert.deepEqual(
  selectCompletedStandardBreedArtworkGallery([
    campaign({ id: "afghan", breedCode2: "AF", breedName: "Afghan Hound", artworkAssetReference: "/breed-art/Afghan_Final .jpg" }),
    campaign({ id: "boxer", breedCode2: "BX", breedName: "Boxer", artworkAssetReference: "/breed-art/Boxer_Final.jpg" }),
    campaign({ id: "chow", breedCode2: "CO", breedName: "Chow Chow", artworkAssetReference: "/breed-art/Chow_Final.jpg" }),
    campaign({ id: "missing-art", breedCode2: "BE", breedName: "Beagle", artworkAssetReference: null }),
  ] as any).map((item) => [item.breedCode2, item.artworkAssetReference]),
  [
    ["AF", "/breed-art/Afghan_Final .jpg"],
    ["BX", "/breed-art/Boxer_Final.jpg"],
    ["CO", "/breed-art/Chow_Final.jpg"],
  ],
  "finalized Afghan, Boxer, and Chow artwork paths remain eligible for the completed gallery"
);
assert.match(gallery, /<details/);
assert.match(gallery, /<summary/);
assert.match(gallery, /new Intl\.DateTimeFormat/);
assert.match(gallery, /artwork by/);
assert.match(gallery, /campaign\.recognition/);
assert.match(gallery, /href=\{`\/kennels\/\$\{kennel\.kennelSlug\}`\}/);
assert.doesNotMatch(gallery, /amountCents|fundedUnits|providerPaymentId|ArtContribution/);
assert.match(page, /selectCompletedStandardBreedArtworkGallery/);
assert.match(card, /campaign\.status === "DRAWING_COMPLETE" && artworkAssetReference/);
assert.match(completionScript, /completeArtCampaignArtwork/);
assert.match(completionScript, /breedCode2: "AF", assetReference: "\/breed-art\/Afghan_Final \.jpg"/);
assert.match(completionScript, /breedCode2: "BX", assetReference: "\/breed-art\/Boxer_Final\.jpg"/);
assert.match(completionScript, /breedCode2: "CO", assetReference: "\/breed-art\/Chow_Final\.jpg"/);
assert.match(completionScript, /PublicReign \/ On Discord at https:\/\/discord\.com\/users\/768273753570148412/);
assert.doesNotMatch(completionScript, /artCampaign\.update|artArtwork\.create/);
assert.match(dogProfile, /getEligibleStandardBreedArtworkCampaigns/);
assert.match(dogProfile, /Want Breed Art\?/);
assert.doesNotMatch(dogProfile, /Afghan Hound|Boxer|Chow Chow/);
console.log("ART-10 completed artwork gallery checks passed.");
