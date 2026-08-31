import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");
const source = (path: string) => readFileSync(join(root, path), "utf8");

function main() {
  const page = source("apps/web/app/breed-art/page.tsx");
  const card = source("apps/web/components/art/ArtCampaignCard.tsx");
  const presentation = source("apps/web/lib/artCampaignPresentation.ts");
  const header = source("apps/web/components/layout/GameHeaderNav.tsx");

  assert.match(page, /getStandardBreedArtworkBoardSummary/);
  assert.match(page, /summary\.fundedCampaignCount[\s\S]*summary\.totalEligibleCampaignCount/);
  assert.match(page, /summary\.drawingCompleteCount/);
  assert.match(page, /summary\.helpFinishCampaigns\.map/);
  assert.match(page, /summary\.campaigns\.map/);
  assert.doesNotMatch(page + card, /\b314\b|\b318\b/);
  assert.match(page, /artistAllocationCents\)\} compensates the artist/);
  assert.match(page, /showRingAllocationCents\)\} supports ShowRing development and operating expenses/);
  assert.match(page, /Contributions will be available in/);
  assert.doesNotMatch(page + card, /donation|donor/i);
  assert.doesNotMatch(page + card, /PayPal|fetch\(|<button|Contribute/);
  assert.match(page, /Interested in contributing art to ShowRing\?/);
  assert.match(page, /href="\/inbox\/messages\/start\/devtest"[\s\S]*Message us to learn more\./);
  assert.doesNotMatch(page, /showringgame@gmail\.com/);
  assert.match(card, /<progress[\s\S]*value=\{progress\.amountFundedCents\}[\s\S]*max=\{progress\.fundingGoalCents\}/);
  assert.match(card, /amountSummary/);
  assert.match(presentation, /NEEDS_FUNDING: "Needs Funding"/);
  assert.match(presentation, /FUNDED: "Funded — Awaiting Artwork"/);
  assert.match(presentation, /DRAWING_COMPLETE: "Drawing Complete"/);
  assert.match(header, /\{ label: "Breed Art", href: "\/breed-art" \}/);
  console.log("ART-04 Breed Art funding board shell checks passed.");
}

main();
