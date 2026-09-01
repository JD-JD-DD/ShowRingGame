import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const service = readFileSync(join(process.cwd(), "apps/web/server/services/annualChampionshipPointSchedule.service.ts"), "utf8");
const page = readFileSync(join(process.cwd(), "apps/web/app/point-schedules/page.tsx"), "utf8");
const filters = readFileSync(join(process.cwd(), "apps/web/app/point-schedules/PointScheduleTableClient.tsx"), "utf8");
const navigation = readFileSync(join(process.cwd(), "apps/web/components/layout/GameHeaderNav.tsx"), "utf8");

assert.ok(service.includes('status: "PUBLISHED"'), "reference service lists only published schedule publications");
assert.ok(service.includes("getPublishedAnnualChampionshipPointScheduleTable"), "reference service has a dedicated set-based table read");
assert.ok(service.includes("...(args.district === undefined ? {} : { district: args.district })"), "Division is an exact district filter, not an aggregate record");
assert.ok(!service.includes("annualChampionshipPointSchedule.delete"), "reference service adds no schedule deletion path");
assert.ok(page.includes('redirect("/login")') && page.includes('redirect("/onboarding")'), "Point Schedules page follows authenticated kennel access conventions");
assert.ok(page.includes("getShowDistrictPresentationLabel") && page.includes("SHOW_DISTRICT_REGIONS"), "page reuses canonical district-region labels while retaining numeric district values");
assert.ok(page.includes("All Districts") && !page.includes("All Divisions"), "page presents player-facing District terminology");
assert.ok(filters.includes("Dogs") && filters.includes("Bitches"), "table uses player-facing sex labels");
assert.ok(filters.includes("overflow-x-auto") && filters.includes("scope=\"colgroup\""), "table remains responsive and semantic");
assert.ok(filters.includes("point-schedule-search") && filters.includes("point-schedule-group") && filters.includes("point-schedule-breed"), "filters provide explicit native form controls");
assert.ok(filters.includes("search.trim()") && filters.includes("toLocaleLowerCase"), "search trims input and matches breed names case-insensitively");
assert.ok(filters.includes("handleGroupChange") && filters.includes("setBreedCode2(\"\")"), "changing group clears an incompatible breed selection");
assert.ok(filters.includes("No breeds match these filters."), "filters provide a neutral empty state");
assert.ok(!page.includes("DRAFT") && !page.includes("calculationVersion"), "page does not expose draft or operational publication metadata");
assert.ok(navigation.includes('{ label: "Point Schedules", href: "/point-schedules" }'), "Account menu exposes Point Schedules");

console.log("Point Schedule reference page checks passed.");
