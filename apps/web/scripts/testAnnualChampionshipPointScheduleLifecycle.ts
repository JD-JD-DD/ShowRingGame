import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const build = source("apps/web/server/services/annualChampionshipPointScheduleBuild.service.ts");
const judging = source("apps/web/server/services/judging.service.ts");
const annualService = source("apps/web/server/services/annualChampionshipPointSchedule.service.ts");
const gchSchedule = source("apps/web/server/services/grandChampionPointSchedule.service.ts");
const observations = source("apps/web/server/services/annualChampionshipCompetitionObservation.service.ts");
const page = source("apps/web/app/point-schedules/page.tsx");

const publishedNoOp = build.indexOf('if (publication.status === "PUBLISHED")');
const buildReads = build.indexOf("const [breeds, observations, priorSchedules, existingSchedules]");
assert.ok(build.includes("effectiveYear !== sourceYear + 1"), "annual builds reject non-consecutive source/effective years");
assert.ok(publishedNoOp >= 0 && publishedNoOp < buildReads, "published annual builds are a no-op before observation or row reads");
assert.ok(build.includes("expectedKeys.size === actualKeys.size") && build.includes("expectedKeys].every"), "publication requires exact canonical key identity rather than only a row count");
assert.ok(build.includes("ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_BUILD_BATCH_SIZE = 200"), "annual builds use a conservative fixed persistence batch size");
assert.ok(build.includes("rowsAdded >= ANNUAL_CHAMPIONSHIP_POINT_SCHEDULE_BUILD_BATCH_SIZE"), "DRAFT resumes persist only one bounded canonical batch per invocation");
assert.ok(build.includes("rowsRemaining: expected.length - actualKeys.size"), "incomplete DRAFT builds report exact remaining canonical keys");
assert.ok(build.includes("resumeDraftAnnualChampionshipPointSchedulesForEffectiveYear"), "a DRAFT-only resume entry point reuses the canonical builder");
assert.ok(build.includes("Number(existing[field]).toFixed(6) === Number(value).toFixed(6)"), "DRAFT reruns compare persisted decimal rates at database precision");
assert.ok(build.includes('where: { id: publication.id, status: "DRAFT" }'), "DRAFT-to-PUBLISHED transition is guarded");
assert.ok(build.includes('status: "PUBLISHED", publishedAt: new Date()'), "authoritative publication writes publishedAt once during transition");

const publishTransaction = judging.indexOf('runShowDayFinalizationPhase("publishStatus"');
const annualTrigger = judging.lastIndexOf("ensureAnnualChampionshipPointSchedulesForEffectiveYear");
assert.ok(publishTransaction >= 0 && annualTrigger > publishTransaction, "Invitational annual build is triggered only after show-day publish transaction flow");
assert.ok(judging.slice(annualTrigger - 300, annualTrigger + 500).includes("try"), "annual build failure is isolated from completed Invitational results");
assert.ok(judging.includes("sourceYear: showDay.cluster.year") && judging.includes("effectiveYear: showDay.cluster.year + 1"), "canonical Invitational trigger uses Year N to Year N+1");
assert.ok(judging.includes("showDay.cluster.year >= 17"), "dynamic CH consumption remains gated by the ShowCluster effective year");
assert.ok(judging.includes("calculateHigherLevelChampionshipUpgrade"), "Group/BIS uses persisted higher-level comparison facts rather than annual lookup");

assert.ok(annualService.includes('publication.status !== "PUBLISHED"') && annualService.includes("!publication.publishedAt"), "CH authority requires published header status and timestamp");
assert.ok(gchSchedule.includes("getPublishedAnnualChampionshipPointSchedule"), "GCH delegates to the same published annual schedule authority");
assert.ok(!gchSchedule.includes("resolveAnnualChampionshipPointScheduleSource"), "GCH does not calculate or fall back during judging");
assert.ok(observations.includes("isInvitationalClusterId") && observations.includes("continue"), "Invitational WD/WB awards are excluded from annual observations");
assert.ok(page.includes("listPublishedAnnualChampionshipPointScheduleYears") && !page.includes("DRAFT"), "player reference page lists published schedules only");
assert.ok(!page.includes("ensureAnnualChampionshipPointSchedulesForEffectiveYear"), "player reference page does not trigger annual generation");

const publishJob = source("apps/web/server/services/publishShowResultsJob.service.ts");
assert.ok(publishJob.includes("resumeDraftAnnualChampionshipPointSchedulesForEffectiveYear"), "finalizer cron resumes the current-year DRAFT through the schedule service");
assert.ok(publishJob.includes("Math.floor(currentEpoch / SHOW_YEAR_HOURS) + 1"), "resume targets only the current effective year");

console.log("Annual Championship Point Schedule lifecycle checks passed.");
