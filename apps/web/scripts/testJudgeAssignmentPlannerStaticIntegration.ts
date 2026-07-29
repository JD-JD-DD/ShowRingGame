import fs from "node:fs";
import path from "node:path";

function assertIncludes(source: string, expected: string, label: string): void {
  if (!source.includes(expected)) throw new Error(`${label}: missing ${expected}`);
}

const root = path.resolve(process.cwd());
const route = fs.readFileSync(path.join(root, "app/api/jobs/maintain-show-schedule/route.ts"), "utf8");
const schedule = fs.readFileSync(path.join(root, "server/services/showSchedule.service.ts"), "utf8");
const invitational = fs.readFileSync(path.join(root, "server/services/invitational.service.ts"), "utf8");
const planner = fs.readFileSync(path.join(root, "server/services/judgeAssignmentPlanner.service.ts"), "utf8");

assertIncludes(route, "ensureGeneratedShowSchedule({", "maintenance route boundary");
assertIncludes(route, "includeJudgingBlocks: false", "maintenance does not create breed blocks");
assertIncludes(schedule, "ensureWeekJudgeAssignmentPlans({", "ordinary weekly planner boundary");
assertIncludes(schedule, "generatedClustersForJudgePlanning", "ordinary clusters grouped before planning");
assertIncludes(planner, "await db.$transaction", "group assignment transaction");
assertIncludes(planner, "tx.showDayGroupJudgeAssignment.createMany", "group assignment persistence");
assertIncludes(planner, "data: { judgeId: day.bisJudgeId }", "BIS persistence");
assertIncludes(invitational, "planWeekJudgeAssignments({", "Week 52 planner boundary");
assertIncludes(invitational, "await tx.showDayGroupJudgeAssignment.createMany", "Week 52 assignment persistence");
assertIncludes(invitational, "await db.$transaction", "Week 52 transaction");
if (planner.includes("ShowJudgingBlock") || planner.includes("showJudgingBlock")) {
  throw new Error("planner must not create or use ShowJudgingBlock records");
}

console.log("Judge assignment static integration checks passed.");
