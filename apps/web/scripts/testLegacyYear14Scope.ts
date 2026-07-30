import { strict as assert } from "node:assert";
import { isProtectedLegacyYear14OrdinaryCluster, isProtectedLegacyYear14OrdinaryShowDay } from "../server/services/showDayGroupJudgeAssignment.service";

const valid = { id: "generated-year-14-fixed-week-45-slot-3", year: 14 };
assert.ok(isProtectedLegacyYear14OrdinaryCluster(valid));
assert.ok(isProtectedLegacyYear14OrdinaryShowDay({ cluster: valid, assignmentCount: 0 }));
for (const cluster of [
  { id: "generated-year-15-fixed-week-1-slot-1", year: 15 },
  { id: "generated-year-13-fixed-week-1-slot-1", year: 13 },
  { id: "invitational-year-14", year: 14 },
  { id: "invitational-year-14-week-52", year: 14 },
  { id: "manual-year-14-show", year: 14 },
  { id: "generated-year-14-week-45-slot-3", year: 14 },
]) assert.equal(isProtectedLegacyYear14OrdinaryCluster(cluster), false);
assert.equal(isProtectedLegacyYear14OrdinaryShowDay({ cluster: valid, assignmentCount: 1 }), false);
assert.equal(isProtectedLegacyYear14OrdinaryShowDay({ cluster: valid, assignmentCount: 8 }), false);
console.log("Legacy Year 14 scope checks passed.");
