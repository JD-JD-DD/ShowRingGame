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
const showEntryRoute = source("apps/web/app/api/shows/[showId]/enter/route.ts");
const showPage = source("apps/web/app/shows/[showId]/page.tsx");
const showPlanner = source("apps/web/app/shows/[showId]/ShowEntryPlanner.tsx");

assertIncludes(
  showEntryService,
  'type ShowEntryErrorCode =',
  "show entry service defines stable machine-readable error codes"
);
assertIncludes(
  showEntryService,
  '"INSUFFICIENT_FUNDS"',
  "show entry service includes the insufficient-funds code"
);
assertIncludes(
  showEntryService,
  '"NO_ELIGIBLE_ENTRIES"',
  "show entry service includes the no-eligible-entries code"
);
assertIncludes(
  showEntryService,
  '"DOG_EMERGENCY_CARE"',
  "show entry service includes the emergency-care code"
);
assertIncludes(
  showEntryService,
  "currentBalance?: number;",
  "show entry service exposes current balance in safe error details"
);
assertIncludes(
  showEntryService,
  "totalRequired?: number;",
  "show entry service exposes total required in safe error details"
);
assertIncludes(
  showEntryService,
  "shortfall?: number;",
  "show entry service exposes shortfall in safe error details"
);
assertIncludes(
  showEntryService,
  'skipSelection("DOG_EMERGENCY_CARE")',
  "all-eligible submission skips emergency-care conflicts instead of failing the whole request"
);
assertIncludes(
  showEntryService,
  'code: "NO_ELIGIBLE_ENTRIES"',
  "all-invalid bulk submissions fail with the specific no-eligible-entries code"
);
assertIncludes(
  showEntryService,
  "skippedSelectionReasons",
  "bulk submission results report skipped selections by reason"
);
assertIncludes(
  showEntryRoute,
  "entryErrorCode",
  "show entry route preserves safe error codes through redirect state"
);
assertIncludes(
  showEntryRoute,
  "entryErrorDetails",
  "show entry route preserves safe structured error details through redirect state"
);
assertIncludes(
  showEntryRoute,
  "dogDaySelections",
  "show entry route preserves submitted selections after correctable failures"
);
assertIncludes(
  showEntryRoute,
  "payload.unexpected",
  "show entry route only emits unexpected-failure logs for non-classified errors"
);
assertIncludes(
  showEntryRoute,
  "We could not submit these entries because of an unexpected server error.",
  "show entry route uses the new generic unexpected-error fallback"
);
assertIncludes(
  showPage,
  "selectedDogDaySelections",
  "show page restores exact dog/day selections after redirect"
);
assertIncludes(
  showPage,
  'entryErrorCode === "NO_ELIGIBLE_ENTRIES"',
  "show page shows refresh guidance for stale planner errors"
);
assertIncludes(
  showPlanner,
  "initiallySelectedSelections",
  "planner accepts exact selections for correction retries"
);
assertIncludes(
  showPlanner,
  "eligibleSelectionKeys",
  "planner only restores still-valid selections after stale-state refreshes"
);

console.log("Calendar show-entry error reporting checks passed.");
