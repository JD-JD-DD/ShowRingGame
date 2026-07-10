import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { CareerMilestones } from "../components/awards/CareerMilestones";
import { InvitationalHistoryCard } from "../components/awards/InvitationalHistoryCard";
import { InvitationalRecognitionBadge } from "../components/awards/InvitationalRecognitionBadge";
import { RibbonTotalTile } from "../components/awards/RibbonTotalTile";
import {
  getInvitationalRibbonAssetPath,
  getRegularRibbonAssetPath,
  RIBBON_TOTAL_ORDER,
} from "../lib/awards/ribbonRoomUi";

function rootDir(): string {
  const cwd = process.cwd();
  return cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;
}

function source(path: string): string {
  return readFileSync(join(rootDir(), path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

function assetExists(assetPath: string): boolean {
  return existsSync(join(rootDir(), "apps/web/public", assetPath.slice(1)));
}

const ribbonRoomPage = source("apps/web/app/dogs/[dogId]/ribbon-room/page.tsx");
const dogPage = source("apps/web/app/dogs/[dogId]/page.tsx");
const service = source("apps/web/server/services/ribbonRoom.service.ts");

assertIncludes(
  ribbonRoomPage,
  "getDogRibbonRoom(dogId)",
  "ribbon room route consumes the canonical service"
);
assertIncludes(
  ribbonRoomPage,
  "RIBBON_TOTAL_ORDER.map((award) =>",
  "page renders the full stable ribbon award grid"
);
assertIncludes(
  ribbonRoomPage,
  "formatRank(ribbonRoom.currentYear.breedRank)",
  "missing current-year ranks are formatted through the neutral rank helper"
);
assertIncludes(
  ribbonRoomPage,
  "<CareerMilestones milestones={ribbonRoom.milestones} />",
  "page renders milestones from the DTO"
);
assertIncludes(
  ribbonRoomPage,
  "target=\"_blank\"",
  "registered dog name links open in a new tab"
);
assertIncludes(
  ribbonRoomPage,
  "rel=\"noopener noreferrer\"",
  "new-tab dog page link uses safe rel attributes"
);
assertIncludes(
  ribbonRoomPage,
  "No BIS, group, breed, or Select awards recorded yet.",
  "page includes the graphical ribbon empty state"
);
assertIncludes(
  ribbonRoomPage,
  "No Invitational history recorded yet.",
  "page includes the invitational empty state"
);
assertIncludes(
  dogPage,
  'href={`/dogs/${header.dogId}/ribbon-room`}',
  "dog page contains the Ribbon Room link"
);

for (const award of RIBBON_TOTAL_ORDER) {
  assert.equal(
    assetExists(getRegularRibbonAssetPath(award)),
    true,
    `regular ribbon asset exists for ${award}`
  );
}

for (const status of [
  "BEST_IN_SHOW",
  "RESERVE_BEST_IN_SHOW",
  "GROUP_FIRST",
  "GROUP_SECOND",
  "GROUP_THIRD",
  "GROUP_FOURTH",
  "BEST_OF_BREED",
  "BEST_OF_OPPOSITE_SEX",
  "SELECT",
] as const) {
  const assetPath = getInvitationalRibbonAssetPath(status);
  assert.ok(assetPath, `invitational asset path resolves for ${status}`);
  assert.equal(
    assetExists(assetPath),
    true,
    `invitational ribbon asset exists for ${status}`
  );
}

const zeroRibbonMarkup = renderToStaticMarkup(
  <RibbonTotalTile
    label="BIS"
    count={0}
    assetPath={getRegularRibbonAssetPath("BIS")}
    alt="Best in Show"
  />
);
assertIncludes(zeroRibbonMarkup, ">0<", "zero-count ribbon tiles render safely");
assertIncludes(
  zeroRibbonMarkup,
  getRegularRibbonAssetPath("BIS"),
  "ribbon total tile uses regular assets"
);

const invitationalRosetteMarkup = renderToStaticMarkup(
  <InvitationalHistoryCard
    record={{ year: 12, week: 52, status: "GROUP_FIRST" }}
  />
);
assertIncludes(
  invitationalRosetteMarkup,
  "/awards/ribbons/invitational/group-first.svg",
  "invitational rosette history cards use invitational assets"
);

const invitationalBadgeMarkup = renderToStaticMarkup(
  <InvitationalHistoryCard record={{ year: 11, week: 52, status: "INVITED" }} />
);
assertIncludes(
  invitationalBadgeMarkup,
  "Invited",
  "non-rosette invitational history cards render status labels"
);
assert.ok(
  !invitationalBadgeMarkup.includes("/awards/ribbons/invitational/"),
  "non-rosette invitational history cards use the badge instead of a ribbon asset"
);

const arbitraryBadgeMarkup = renderToStaticMarkup(
  <InvitationalRecognitionBadge label="3rd Place" />
);
assertIncludes(
  arbitraryBadgeMarkup,
  "3rd Place",
  "the invitational badge supports arbitrary wording"
);

const milestonesMarkup = renderToStaticMarkup(
  <CareerMilestones
    milestones={[
      { type: "FIRST_ENTRY", year: 2, week: 8 },
      { type: "CHAMPION", year: 4, week: 21 },
    ]}
  />
);
assertIncludes(
  milestonesMarkup,
  "Year 2, Week 8",
  "milestones render year and week"
);
assertIncludes(
  milestonesMarkup,
  "Champion Completed",
  "milestones render readable milestone labels"
);

const emptyMilestonesMarkup = renderToStaticMarkup(
  <CareerMilestones milestones={[]} />
);
assertIncludes(
  emptyMilestonesMarkup,
  "Career milestones will appear as this dog builds a show record.",
  "milestones empty state renders"
);

assert.ok(
  !ribbonRoomPage.includes("traitHead") &&
    !ribbonRoomPage.includes("traitForequarters") &&
    !ribbonRoomPage.includes("hiddenTraits"),
  "ribbon room page does not render hidden trait fields"
);
assertIncludes(
  service,
  "regNumber: true",
  "ribbon room service selects the public registration number"
);
assertIncludes(
  service,
  "week: 52",
  "ribbon room service supplies invitational week data"
);

console.log("Ribbon Room page checks passed.");
