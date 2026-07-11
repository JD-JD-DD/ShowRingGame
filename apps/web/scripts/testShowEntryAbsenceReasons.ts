import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  formatShowEntryAbsenceReason,
  formatShowEntryStatusShortLabel,
} from "../lib/showEntryAbsence";

const repoRoot = path.resolve(__dirname, "..", "..", "..");

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertIncludes(sourceText: string, needle: string, label: string) {
  assert.ok(sourceText.includes(needle), label);
}

assert.equal(
  formatShowEntryAbsenceReason("PREGNANT_AT_SHOW"),
  "This bitch was pregnant at show time.",
  "pregnancy absence reason maps to the shared player-facing sentence"
);
assert.equal(
  formatShowEntryAbsenceReason("POST_WHELP_REST_AT_SHOW"),
  "This bitch was still in post-whelp rest at show time.",
  "post-whelp rest reason maps to the shared player-facing sentence"
);
assert.equal(
  formatShowEntryAbsenceReason("DECEASED_BEFORE_SHOW"),
  "This dog died before judging.",
  "death reason maps to the shared player-facing sentence"
);
assert.equal(
  formatShowEntryAbsenceReason("UNDER_MINIMUM_SHOW_AGE"),
  "This dog was too young to compete at show time.",
  "underage reason maps to the shared player-facing sentence"
);
assert.equal(
  formatShowEntryAbsenceReason("OVER_MAXIMUM_SHOW_AGE"),
  "This dog was above the maximum show age at show time.",
  "overage reason maps to the shared player-facing sentence"
);
assert.equal(
  formatShowEntryAbsenceReason("OWNERSHIP_CHANGED"),
  "This dog was no longer owned by the entering kennel at show time.",
  "ownership-change reason maps to the shared player-facing sentence"
);
assert.equal(
  formatShowEntryAbsenceReason("LIFECYCLE_UNAVAILABLE"),
  "This dog was unavailable to compete at show time.",
  "generic lifecycle reason maps to the shared player-facing sentence"
);
assert.equal(
  formatShowEntryAbsenceReason(null),
  null,
  "historical manual absences with null reason remain valid"
);
assert.equal(
  formatShowEntryStatusShortLabel({ entryStatus: "ABSENT", absenceReason: null }),
  "Absent",
  "status label safely falls back to Absent for null absence reasons"
);
assert.equal(
  formatShowEntryStatusShortLabel({ entryStatus: "INELIGIBLE", absenceReason: null }),
  "Ineligible",
  "ineligible entries do not reuse absence wording"
);

assertIncludes(
  source("apps/web/prisma/schema.prisma"),
  "enum ShowEntryAbsenceReason",
  "Prisma schema defines the canonical show-entry absence reason enum"
);
assertIncludes(
  source("apps/web/prisma/schema.prisma"),
  "absenceReason        ShowEntryAbsenceReason?",
  "Prisma schema adds the nullable absenceReason field to ShowEntry"
);
assertIncludes(
  source("apps/web/app/my-results/page.tsx"),
  "formatShowEntryAbsenceReason(entry.absenceReason)",
  "My Results renders the stored absence reason"
);
assertIncludes(
  source("apps/web/app/shows/[showId]/results/[breedCode2]/page.tsx"),
  "formatShowEntryAbsenceReason(entry.absenceReason)",
  "breed results page renders the stored absence reason"
);
assertIncludes(
  source("apps/web/server/services/dog.service.ts"),
  "absenceReasonMessage: formatShowEntryAbsenceReason(entry.absenceReason)",
  "dog-profile entry mapper exposes the stored absence reason message"
);

console.log("Show-entry absence reason checks passed.");
