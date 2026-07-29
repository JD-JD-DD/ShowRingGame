import {
  getJudgeAssignmentPlanState,
  planWeekJudgeAssignments,
  type PlannerJudge,
} from "../server/services/judgeAssignmentPlanner.service";
import { CANONICAL_SHOW_GROUP_CODES } from "@showring/rules";

function assert(value: unknown, label: string): asserts value {
  if (!value) throw new Error(label);
}

const judges: PlannerJudge[] = Array.from({ length: 24 }, (_, index) => ({
  id: `judge-${index + 1}`,
  judgeCode: `J${index + 1}`,
  name: `Judge ${index + 1}`,
}));
const clusters = [2, 4, 2].map((dayCount, index) => ({
  id: `cluster-${index + 1}`,
  stableIdentity: `week-1-slot-${index + 1}`,
  district: index + 1,
  showDays: Array.from({ length: dayCount }, (_, dayIndex) => ({
    id: `cluster-${index + 1}-day-${dayIndex + 1}`,
    dayIndex: dayIndex + 1,
    scheduledEpoch: dayIndex,
  })),
}));
const plans = planWeekJudgeAssignments({ year: 16, weekInYear: 1, clusters, judges });

assert(plans.length === 3, "three cluster plans");
assert(new Set(plans.flatMap((plan) => plan.panelJudgeIds)).size === 24, "weekly judge exclusion");
for (const plan of plans) {
  assert(plan.panelJudgeIds.length === 8, "eight-judge panel");
  for (const day of plan.days) {
    assert(day.assignments.length === 8, "eight group assignments per day");
    assert(new Set(day.assignments.map((assignment) => assignment.judgeId)).size === 8, "distinct daily judges");
    assert(day.assignments.map((assignment) => assignment.groupCode).join(",") === CANONICAL_SHOW_GROUP_CODES.join(","), "canonical groups");
    assert(plan.panelJudgeIds.includes(day.bisJudgeId), "BIS belongs to panel");
  }
  for (const judgeId of plan.panelJudgeIds) {
    assert(new Set(plan.days.map((day) => day.assignments.find((assignment) => assignment.judgeId === judgeId)?.groupCode)).size === plan.days.length, "no repeated group in cluster");
  }
}
assert(
  plans.find((plan) => plan.clusterId === "cluster-1")!.days.flatMap((day) => day.assignments).length === 16,
  "two-day cluster assignment count"
);
assert(
  plans.find((plan) => plan.clusterId === "cluster-2")!.days.flatMap((day) => day.assignments).length === 32,
  "four-day cluster assignment count"
);
const invitationalPlan = planWeekJudgeAssignments({
  year: 16,
  weekInYear: 52,
  judges: judges.slice(0, 8),
  clusters: [
    {
      id: "invitational-year-16",
      stableIdentity: "invitational-year-16",
      district: 1,
      showDays: [{ id: "invitational-day", dayIndex: 1, scheduledEpoch: 0 }],
    },
  ],
});
assert(invitationalPlan.length === 1, "Week 52 permits one cluster");
assert(invitationalPlan[0]!.days[0]!.assignments.length === 8, "Week 52 eight groups");
assert(invitationalPlan[0]!.panelJudgeIds.includes(invitationalPlan[0]!.days[0]!.bisJudgeId), "Week 52 BIS belongs to panel");

const completeDay = {
  status: "SCHEDULED",
  judgeId: "judge-1",
  groupJudgeAssignments: CANONICAL_SHOW_GROUP_CODES.map((groupCode, index) => ({
    groupCode,
    judgeId: `judge-${index + 1}`,
  })),
};
assert(getJudgeAssignmentPlanState({ showDays: [{ ...completeDay }] }) === "complete", "complete plan state");
assert(getJudgeAssignmentPlanState({ showDays: [{ ...completeDay, groupJudgeAssignments: [] }] }) === "empty", "empty plan state");
assert(getJudgeAssignmentPlanState({ showDays: [{ ...completeDay, groupJudgeAssignments: completeDay.groupJudgeAssignments.slice(1) }] }) === "partial", "missing group plan state");
assert(getJudgeAssignmentPlanState({ showDays: [{ ...completeDay, groupJudgeAssignments: completeDay.groupJudgeAssignments.map((assignment) => ({ ...assignment, judgeId: "judge-1" })) }] }) === "partial", "repeated judge plan state");
assert(getJudgeAssignmentPlanState({ showDays: [{ ...completeDay, judgeId: "outside-panel" }] }) === "partial", "BIS outside panel state");
assert(getJudgeAssignmentPlanState({ showDays: [{ ...completeDay }, { ...completeDay, judgeId: "judge-9", groupJudgeAssignments: completeDay.groupJudgeAssignments.map((assignment, index) => ({ ...assignment, judgeId: `judge-${index + 9}` })) }] }) === "partial", "inconsistent cluster panel state");
assert(getJudgeAssignmentPlanState({ showDays: [{ ...completeDay, status: "JUDGING", groupJudgeAssignments: [] }] }) === "protected", "judged partial plan state");
assert(JSON.stringify(plans) === JSON.stringify(planWeekJudgeAssignments({ year: 16, weekInYear: 1, clusters, judges })), "deterministic plan");
console.log("Judge assignment planner checks passed.");
