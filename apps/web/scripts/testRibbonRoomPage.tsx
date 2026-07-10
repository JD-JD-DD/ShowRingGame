import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { CareerMilestones } from "../components/awards/CareerMilestones";
import { InvitationalHistoryCard } from "../components/awards/InvitationalHistoryCard";
import { InvitationalRecognitionBadge } from "../components/awards/InvitationalRecognitionBadge";
import { RibbonTotalsSection } from "../components/awards/RibbonTotalsSection";
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

function assertBefore(
  haystack: string,
  first: string,
  second: string,
  label: string
): void {
  const firstIndex = haystack.indexOf(first);
  const secondIndex = haystack.indexOf(second);

  assert.ok(firstIndex >= 0, `${label}: missing first marker`);
  assert.ok(secondIndex >= 0, `${label}: missing second marker`);
  assert.ok(firstIndex < secondIndex, label);
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
  "<RibbonTotalsSection ribbons={ribbonRoom.ribbons} />",
  "page delegates ribbon totals rendering to the detail-capable totals section"
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
assertIncludes(
  dogPage,
  'className="w-full rounded-2xl border border-[var(--dog-border)] bg-white/5',
  "dog page renders Ribbon Room as a full-width secondary action"
);
assertIncludes(
  dogPage,
  "Ribbon Room",
  "dog page uses the lighter secondary styling for Ribbon Room"
);
assertBefore(
  dogPage,
  "</DogProfileKennelRunMove>",
  "href={`/dogs/${header.dogId}/ribbon-room`}",
  "dog page places Ribbon Room after the six primary action slots"
);
assertBefore(
  dogPage,
  "href={`/dogs/${header.dogId}/ribbon-room`}",
  "{actions.canBuyActiveListing && saleListing ? (",
  "dog page places Ribbon Room before the lower market-action grid"
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

const ribbonDetailsMarkup = renderToStaticMarkup(
  <RibbonTotalsSection
    ribbons={[
      {
        award: "SELECT",
        count: 2,
        history: [
          {
            show: { id: "show-1", name: "Spring Cluster" },
            judge: { id: "judge-1", name: "Judge Blue" },
            year: 8,
            week: 12,
            dogsDefeated: 3,
            pointsEarned: 1,
            award: "SELECT",
            originalAwardCode: "SELECT_DOG",
            awardGroup: "BREED",
          },
          {
            show: { id: "show-2", name: "Summer Cluster" },
            judge: { id: "judge-2", name: "" },
            year: 9,
            week: 4,
            dogsDefeated: 0,
            pointsEarned: 0,
            award: "SELECT",
            originalAwardCode: "SELECT_BITCH",
            awardGroup: "BREED",
          },
        ],
      },
    ]}
    initialSelectedAward="SELECT"
  />
);
assertIncludes(
  ribbonDetailsMarkup,
  'role="dialog"',
  "positive-count ribbon totals can open an accessible detail view"
);
assertIncludes(
  ribbonDetailsMarkup,
  "Close",
  "detail view exposes a close action"
);
assertIncludes(
  ribbonDetailsMarkup,
  "Full recorded history, newest first.",
  "detail view announces newest-first ordering"
);
assertIncludes(
  ribbonDetailsMarkup,
  "Year 9, Week 4",
  "detail view renders year and week"
);
assertIncludes(
  ribbonDetailsMarkup,
  "Judge not recorded",
  "missing optional judge values render safely"
);
assertIncludes(
  ribbonDetailsMarkup,
  "Select Dog",
  "SELECT history preserves Select Dog labeling"
);
assertIncludes(
  ribbonDetailsMarkup,
  "Select Bitch",
  "SELECT history preserves Select Bitch labeling"
);
assert.ok(
  ribbonDetailsMarkup.indexOf("Year 9, Week 4") <
    ribbonDetailsMarkup.indexOf("Year 8, Week 12"),
  "occurrences render newest first"
);
assert.ok(
  !ribbonDetailsMarkup.includes("Dogs defeated</span><span>0"),
  "missing optional dogs-defeated values are omitted safely"
);

const zeroDetailsSectionMarkup = renderToStaticMarkup(
  <RibbonTotalsSection
    ribbons={[
      {
        award: "BIS",
        count: 0,
        history: [],
      },
    ]}
  />
);
assert.ok(
  !zeroDetailsSectionMarkup.includes('role="dialog"'),
  "zero-count ribbon totals do not open an empty detail view"
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
assertIncludes(
  service,
  "originalAwardCode: award.awardCode",
  "ribbon room service preserves the specific stored award code for detail display"
);

console.log("Ribbon Room page checks passed.");
