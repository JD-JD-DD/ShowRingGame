import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const service = readFileSync(join(process.cwd(), "apps/web/server/services/annualChampionshipPointSchedule.service.ts"), "utf8");
const page = readFileSync(join(process.cwd(), "apps/web/app/point-schedules/page.tsx"), "utf8");
const navigation = readFileSync(join(process.cwd(), "apps/web/components/layout/GameHeaderNav.tsx"), "utf8");

assert.ok(service.includes('status: "PUBLISHED"'), "reference service lists only published schedule publications");
assert.ok(service.includes("getPublishedAnnualChampionshipPointScheduleTable"), "reference service has a dedicated set-based table read");
assert.ok(service.includes("...(args.district === undefined ? {} : { district: args.district })"), "Division is an exact district filter, not an aggregate record");
assert.ok(!service.includes("annualChampionshipPointSchedule.delete"), "reference service adds no schedule deletion path");
assert.ok(page.includes('redirect("/login")') && page.includes('redirect("/onboarding")'), "Point Schedules page follows authenticated kennel access conventions");
assert.ok(page.includes("All Divisions") && page.includes("Division {district}"), "page presents Division terminology and All Divisions aggregation");
assert.ok(page.includes("Dogs") && page.includes("Bitches"), "table uses player-facing sex labels");
assert.ok(page.includes("overflow-x-auto") && page.includes("scope=\"colgroup\""), "table remains responsive and semantic");
assert.ok(!page.includes("DRAFT") && !page.includes("calculationVersion"), "page does not expose draft or operational publication metadata");
assert.ok(navigation.includes('{ label: "Point Schedules", href: "/point-schedules" }'), "Account menu exposes Point Schedules");

console.log("Point Schedule reference page checks passed.");
