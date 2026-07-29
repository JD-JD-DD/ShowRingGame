import { db } from "@/lib/db";
import {
  CANONICAL_SHOW_GROUP_CODES,
  type CanonicalShowGroupCode,
} from "@showring/rules";

export type PlannerJudge = { id: string; judgeCode: string; name: string };
export type PlannerCluster = {
  id: string;
  stableIdentity: string;
  district: number;
  showDays: Array<{ id: string; dayIndex: number; scheduledEpoch: number; status?: string }>;
};

export type PlannedClusterJudgeAssignments = {
  clusterId: string;
  panelJudgeIds: string[];
  days: Array<{
    showDayId: string;
    assignments: Array<{ groupCode: CanonicalShowGroupCode; judgeId: string }>;
    bisJudgeId: string;
  }>;
};

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRank(seed: string, judgeId: string): number {
  return hashSeed(`${seed}:${judgeId}`);
}

export function planWeekJudgeAssignments(args: {
  year: number;
  weekInYear: number;
  clusters: PlannerCluster[];
  judges: PlannerJudge[];
  annualJudgingDaysByJudgeId?: ReadonlyMap<string, number>;
  recentJudgingDaysByJudgeId?: ReadonlyMap<string, number>;
  annualBisDaysByJudgeId?: ReadonlyMap<string, number>;
  recentBisDaysByJudgeId?: ReadonlyMap<string, number>;
}): PlannedClusterJudgeAssignments[] {
  const annualDays = new Map(args.annualJudgingDaysByJudgeId);
  const recentDays = new Map(args.recentJudgingDaysByJudgeId);
  const annualBisDays = new Map(args.annualBisDaysByJudgeId);
  const recentBisDays = new Map(args.recentBisDaysByJudgeId);
  const clusterOrder = [...args.clusters].sort(
    (left, right) =>
      hashSeed(`${args.year}:${args.weekInYear}:${left.stableIdentity}`) -
        hashSeed(`${args.year}:${args.weekInYear}:${right.stableIdentity}`) ||
      left.stableIdentity.localeCompare(right.stableIdentity)
  );
  const usedThisWeek = new Set<string>();
  const plans: PlannedClusterJudgeAssignments[] = [];

  for (const cluster of clusterOrder) {
    const candidates = args.judges
      .filter((judge) => !usedThisWeek.has(judge.id))
      .sort(
        (left, right) =>
          (annualDays.get(left.id) ?? 0) - (annualDays.get(right.id) ?? 0) ||
          (recentDays.get(left.id) ?? 0) - (recentDays.get(right.id) ?? 0) ||
          seededRank(
            `${args.year}:${args.weekInYear}:${cluster.stableIdentity}:panel`,
            left.id
          ) -
            seededRank(
              `${args.year}:${args.weekInYear}:${cluster.stableIdentity}:panel`,
              right.id
            ) ||
          left.id.localeCompare(right.id)
      );

    if (candidates.length < CANONICAL_SHOW_GROUP_CODES.length) {
      throw new Error(
        `Week ${args.weekInYear} requires ${CANONICAL_SHOW_GROUP_CODES.length} unused active judges per cluster.`
      );
    }

    const panelJudgeIds = candidates
      .slice(0, CANONICAL_SHOW_GROUP_CODES.length)
      .map((judge) => judge.id);
    panelJudgeIds.forEach((judgeId) => usedThisWeek.add(judgeId));
    const rotationOffset =
      hashSeed(`${args.year}:${cluster.stableIdentity}:rotation`) %
      CANONICAL_SHOW_GROUP_CODES.length;
    const days = [...cluster.showDays]
      .sort((left, right) => left.dayIndex - right.dayIndex)
      .map((showDay) => {
        const assignments = CANONICAL_SHOW_GROUP_CODES.map((groupCode, groupIndex) => ({
          groupCode,
          judgeId:
            panelJudgeIds[
              (groupIndex + showDay.dayIndex - 1 + rotationOffset) %
                CANONICAL_SHOW_GROUP_CODES.length
            ]!,
        }));
        const bisJudgeId = [...panelJudgeIds].sort(
          (left, right) =>
            (annualBisDays.get(left) ?? 0) - (annualBisDays.get(right) ?? 0) ||
            (recentBisDays.get(left) ?? 0) - (recentBisDays.get(right) ?? 0) ||
            seededRank(
              `${args.year}:${args.weekInYear}:${cluster.stableIdentity}:${showDay.dayIndex}:bis`,
              left
            ) -
              seededRank(
                `${args.year}:${args.weekInYear}:${cluster.stableIdentity}:${showDay.dayIndex}:bis`,
                right
              ) ||
            left.localeCompare(right)
        )[0]!;

        annualBisDays.set(bisJudgeId, (annualBisDays.get(bisJudgeId) ?? 0) + 1);
        return { showDayId: showDay.id, assignments, bisJudgeId };
      });

    plans.push({ clusterId: cluster.id, panelJudgeIds, days });
  }

  return plans;
}

function isCompletePlan(cluster: {
  showDays: Array<{
    judgeId: string;
    groupJudgeAssignments: Array<{ groupCode: CanonicalShowGroupCode; judgeId: string }>;
  }>;
}): boolean {
  return cluster.showDays.every((showDay) => {
    const assignments = showDay.groupJudgeAssignments;
    return (
      assignments.length === CANONICAL_SHOW_GROUP_CODES.length &&
      new Set(assignments.map((assignment) => assignment.groupCode)).size ===
        CANONICAL_SHOW_GROUP_CODES.length &&
      new Set(assignments.map((assignment) => assignment.judgeId)).size ===
        CANONICAL_SHOW_GROUP_CODES.length &&
      assignments.some((assignment) => assignment.judgeId === showDay.judgeId)
    );
  });
}

export async function ensureWeekJudgeAssignmentPlans(args: {
  year: number;
  weekInYear: number;
  clusters: Array<{ id: string; stableIdentity: string; district: number }>;
  judges: PlannerJudge[];
}): Promise<void> {
  const clusterIds = args.clusters.map((cluster) => cluster.id);
  const clusters = await db.showCluster.findMany({
    where: { id: { in: clusterIds } },
    select: {
      id: true,
      showDays: {
        orderBy: { dayIndex: "asc" },
        select: {
          id: true,
          dayIndex: true,
          scheduledEpoch: true,
          status: true,
          judgeId: true,
          groupJudgeAssignments: { select: { groupCode: true, judgeId: true } },
        },
      },
    },
  });
  if (clusters.length !== args.clusters.length || clusters.some((cluster) => cluster.showDays.length === 0)) {
    return;
  }
  if (clusters.every(isCompletePlan)) {
    return;
  }
  if (
    clusters.some((cluster) =>
      cluster.showDays.some(
        (showDay) =>
          showDay.status === "JUDGING" || showDay.status === "RESULTS_PUBLISHED"
      )
    )
  ) {
    throw new Error("Cannot reconstruct a partial group judge plan for judged or published ShowDays.");
  }

  const distinctAnnualAssignments = await db.showDayGroupJudgeAssignment.findMany({
    where: { showDay: { cluster: { year: args.year } } },
    distinct: ["showDayId", "judgeId"],
    select: { showDayId: true, judgeId: true },
  });
  const annualDays = new Map<string, number>();
  for (const assignment of distinctAnnualAssignments) {
    annualDays.set(assignment.judgeId, (annualDays.get(assignment.judgeId) ?? 0) + 1);
  }
  const bisDays = new Map<string, number>();
  const bisRows = await db.showDay.groupBy({
    by: ["judgeId"],
    where: { cluster: { year: args.year } },
    _count: { _all: true },
  });
  for (const row of bisRows) bisDays.set(row.judgeId, row._count._all);

  const clusterById = new Map(args.clusters.map((cluster) => [cluster.id, cluster]));
  const plans = planWeekJudgeAssignments({
    year: args.year,
    weekInYear: args.weekInYear,
    judges: args.judges,
    annualJudgingDaysByJudgeId: annualDays,
    annualBisDaysByJudgeId: bisDays,
    clusters: clusters.map((cluster) => ({
      id: cluster.id,
      stableIdentity: clusterById.get(cluster.id)!.stableIdentity,
      district: clusterById.get(cluster.id)!.district,
      showDays: cluster.showDays,
    })),
  });

  await db.$transaction(async (tx) => {
    const showDayIds = clusters.flatMap((cluster) => cluster.showDays.map((showDay) => showDay.id));
    await tx.showDayGroupJudgeAssignment.deleteMany({ where: { showDayId: { in: showDayIds } } });
    for (const plan of plans) {
      for (const day of plan.days) {
        await tx.showDayGroupJudgeAssignment.createMany({
          data: day.assignments.map((assignment) => ({
            showDayId: day.showDayId,
            groupCode: assignment.groupCode,
            judgeId: assignment.judgeId,
          })),
        });
        await tx.showDay.update({ where: { id: day.showDayId }, data: { judgeId: day.bisJudgeId } });
      }
    }
  });
}
