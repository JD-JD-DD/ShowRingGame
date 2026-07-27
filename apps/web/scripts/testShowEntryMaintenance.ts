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

const maintenance = source("apps/web/server/services/showEntryMaintenance.service.ts");
const availability = source("apps/web/server/services/showAvailability.service.ts");
const entries = source("apps/web/server/services/showEntry.service.ts");
const showPage = source("apps/web/app/shows/[showId]/page.tsx");
const dogPage = source("apps/web/app/dogs/[dogId]/show-entry/page.tsx");

assertIncludes(maintenance, "SHOW_ENTRY_MAINTENANCE_ACTIVE = true", "maintenance switch is active");
assertIncludes(maintenance, "Existing entries and show results are not affected.", "maintenance message protects existing data");
assertIncludes(availability, "isShowEntryMaintenanceActive()", "availability exposes the maintenance state before entry workflows begin");
assertIncludes(entries, "assertShowEntryMaintenanceAllowsSubmission();", "single-entry service path is server-side protected");
assertIncludes(entries, 'code: "ENTRY_MAINTENANCE"', "cluster, breed, and kennel-run submissions return a stable maintenance error");
assertIncludes(showPage, 'entryStatus === "PAUSED"', "calendar show page displays its paused notice");
assertIncludes(dogPage, "SHOW_ENTRY_MAINTENANCE_MESSAGE", "dog-first entry page displays the maintenance notice");
assertIncludes(entries, "export async function pullShowEntry", "withdrawal service remains available");

console.log("Show entry maintenance checks passed.");
