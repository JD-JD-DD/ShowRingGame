import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

const showEntryService = source("apps/web/server/services/showEntry.service.ts");
const showPage = source("apps/web/app/shows/[showId]/page.tsx");
const showEntryRoute = source("apps/web/app/api/shows/[showId]/enter/route.ts");

assertIncludes(
  showEntryService,
  "export type ExistingEntriesByShowDayDto = {",
  "show entry service exposes the day-summary DTO"
);
assertIncludes(
  showEntryService,
  "export async function listExistingEntriesByShowDay",
  "show entry service exposes a dedicated day-summary helper"
);
assertIncludes(
  showEntryService,
  'kennelId: args.kennelId,',
  "day-summary helper filters by authenticated kennelId"
);
assertIncludes(
  showEntryService,
  'entryStatus: "ENTERED",',
  "day-summary helper counts only currently entered rows"
);
assertIncludes(
  showEntryService,
  "clusterId: args.clusterId,",
  "day-summary helper filters entries through showDay.clusterId"
);
assertIncludes(
  showEntryService,
  "breed: {",
  "day-summary helper selects breed data for grouping"
);
assertIncludes(
  showEntryService,
  "summary.totalDogs += 1;",
  "day-summary helper counts each active show-entry row once"
);
assertIncludes(
  showEntryService,
  "summary.breedsByCode",
  "day-summary helper groups rows by breed within each show day"
);
assertIncludes(
  showEntryService,
  "a.breedName.localeCompare(b.breedName)",
  "day-summary helper alphabetizes breed rows"
);
assertIncludes(
  showEntryService,
  ".sort((a, b) => a.dayIndex - b.dayIndex)",
  "day-summary helper sorts day summaries by day number"
);

assertIncludes(
  showPage,
  "listExistingEntriesByShowDay",
  "show page loads the page-level existing-entry summary helper"
);
assertIncludes(
  showPage,
  "const existingEntriesByShowDay = kennel",
  "show page loads summaries when an authenticated kennel exists"
);
assertIncludes(
  showPage,
  "const existingEntriesSummaryByShowDayId = new Map(",
  "show page indexes summaries by showDayId"
);
assertIncludes(
  showPage,
  "Your Day {day.dayIndex} Entries",
  "show page renders the day-summary heading"
);
assertIncludes(
  showPage,
  "No dogs entered yet.",
  "show page renders the empty day-summary state"
);
assertIncludes(
  showPage,
  "visibleBreeds.map",
  "show page renders grouped breed rows"
);
assertIncludes(
  showPage,
  "selectedScope ?",
  "show page still keeps planner loading scoped separately from the day summary"
);

assertIncludes(
  showEntryRoute,
  "return NextResponse.redirect(url);",
  "existing entry POST redirect behavior remains unchanged"
);

console.log("Calendar show-entry day summary checks passed.");
