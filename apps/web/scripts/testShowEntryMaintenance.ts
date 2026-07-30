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
const dogPlanner = source("apps/web/server/services/dogShowEntryPlanner.service.ts");

assertIncludes(maintenance, "SHOW_ENTRY_MAINTENANCE_ACTIVE = false", "maintenance switch is inactive");
assertIncludes(maintenance, "SHOW_ENTRY_MAINTENANCE_ACTIVE &&", "maintenance switch retains its emergency pause gate");
assertIncludes(maintenance, "SHOW_ENTRY_MAINTENANCE_START_YEAR = 15", "maintenance starts in Year 15, Week 1");
assertIncludes(maintenance, "Existing entries and show results are not affected.", "maintenance message protects existing data");
assertIncludes(availability, "isShowEntryMaintenanceActive(cluster)", "availability pauses only affected clusters before entry workflows begin");
assertIncludes(entries, "isShowEntryMaintenanceActive(block.showDay.cluster)", "single-entry service path is server-side protected");
assertIncludes(entries, 'code: "ENTRY_MAINTENANCE"', "cluster, breed, and kennel-run submissions return a stable maintenance error");
assertIncludes(showPage, 'entryStatus === "PAUSED"', "calendar show page displays its paused notice");
assertIncludes(dogPage, "DogShowEntryPlannerClient", "dog-first entry keeps Year 14 planning available");
assertIncludes(dogPlanner, "availability.canEnter &&", "dog-first planner disables Year 15+ selections before submission");
assertIncludes(entries, "export async function pullShowEntry", "withdrawal service remains available");

console.log("Show entry maintenance checks passed.");
