import { strict as assert } from "node:assert";
import { requireProtectedLegacyYear14FinalizationJudge } from "../server/services/showDayGroupJudgeAssignment.service";

const cluster = { id: "generated-year-14-fixed-week-45-slot-1", year: 14, week: 45 };
const judge = { id: "judge-1", isActive: true, name: "Legacy Judge" };
const resolve = (overrides: Record<string, unknown> = {}) => requireProtectedLegacyYear14FinalizationJudge({ cluster, showDayId: "day-1", assignmentCount: 0, judgeId: "judge-1", judge, ...overrides } as never);
assert.equal(resolve().id, "judge-1");
for (const overrides of [
  { cluster: { ...cluster, year: 15, id: "generated-year-15-fixed-week-1-slot-1" } },
  { cluster: { ...cluster, id: "invitational-year-14" } },
  { cluster: { ...cluster, id: "manual-year-14" } },
  { cluster: { ...cluster, id: "generated-year-14-week-45-slot-1" } },
  { assignmentCount: 1 }, { assignmentCount: 8 }, { judgeId: null }, { judge: null }, { judge: { ...judge, isActive: false } },
]) assert.throws(() => resolve(overrides), /Protected legacy Year 14|Invalid protected legacy/);
console.log("Legacy Year 14 finalization judge checks passed.");
