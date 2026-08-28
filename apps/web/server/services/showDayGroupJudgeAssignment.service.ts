import { Prisma } from "@prisma/client";
import {
  CANONICAL_SHOW_GROUP_CODES,
  isCanonicalShowGroupCode,
  resolveBreedGroupNameToCanonicalShowGroupCode,
} from "@showring/rules";

type ShowDayGroupJudgeAssignmentRow = {
  groupCode: string;
  judgeId: string;
};

// Temporary compatibility scope for protected ordinary Year 14 shows only. Never
// apply this to Year 15 or Invitational shows; remove it after all matching shows
// are complete and published.
export function isProtectedLegacyYear14OrdinaryCluster(cluster: { id: string; year: number }): boolean {
  return cluster.year === 14 && cluster.id.startsWith("generated-year-14-fixed-") && !cluster.id.startsWith("invitational-year-");
}

export function isProtectedLegacyYear14OrdinaryShowDay(args: {
  cluster: { id: string; year: number };
  assignmentCount: number;
}): boolean {
  return isProtectedLegacyYear14OrdinaryCluster(args.cluster) && args.assignmentCount === 0;
}

export function requireProtectedLegacyYear14FinalizationJudge<T extends { id: string; isActive: boolean }>(args: {
  cluster: { id: string; year: number; week?: number };
  showDayId: string;
  assignmentCount: number;
  judgeId: string | null;
  judge: T | null;
}): T {
  const context = `cluster=${args.cluster.id}, showDay=${args.showDayId}, year=${args.cluster.year}, week=${args.cluster.week ?? "unknown"}, assignmentCount=${args.assignmentCount}, judgeId=${args.judgeId ?? "null"}`;
  if (!isProtectedLegacyYear14OrdinaryShowDay({ cluster: args.cluster, assignmentCount: args.assignmentCount })) throw new Error(`Invalid protected legacy Year 14 finalization scope: ${context}.`);
  if (!args.judgeId) throw new Error(`Protected legacy Year 14 finalization judge is missing: ${context}.`);
  if (!args.judge || args.judge.id !== args.judgeId) throw new Error(`Protected legacy Year 14 finalization judge was not found: ${context}.`);
  if (!args.judge.isActive) throw new Error(`Protected legacy Year 14 finalization judge is inactive: ${context}.`);
  return args.judge;
}

export function requireCompleteShowDayJudgePanelForBis(args: {
  showDayId: string;
  bisJudgeId: string | null | undefined;
  assignments: ShowDayGroupJudgeAssignmentRow[];
  clusterId?: string;
  year?: number;
}): { bisJudgeId: string } {
  const canonicalAssignments = args.assignments.filter((assignment) => isCanonicalShowGroupCode(assignment.groupCode));
  const noncanonicalAssignments = args.assignments.filter((assignment) => !isCanonicalShowGroupCode(assignment.groupCode));
  const canonicalGroups = new Set(canonicalAssignments.map((assignment) => assignment.groupCode));
  const canonicalJudgeIds = new Set(canonicalAssignments.map((assignment) => assignment.judgeId));
  const hasAllCanonicalGroups =
    canonicalGroups.size === CANONICAL_SHOW_GROUP_CODES.length &&
    CANONICAL_SHOW_GROUP_CODES.every((groupCode) => canonicalGroups.has(groupCode));
  const hasOnlyLegacyMiscellaneousExtra =
    noncanonicalAssignments.length === 1 &&
    noncanonicalAssignments[0]!.groupCode === "MISCELLANEOUS";
  const bisJudgeInPanel = Boolean(args.bisJudgeId && canonicalJudgeIds.has(args.bisJudgeId));

  if (
    canonicalAssignments.length !== CANONICAL_SHOW_GROUP_CODES.length ||
    (args.assignments.length !== CANONICAL_SHOW_GROUP_CODES.length && !hasOnlyLegacyMiscellaneousExtra) ||
    !hasAllCanonicalGroups ||
    canonicalJudgeIds.size !== CANONICAL_SHOW_GROUP_CODES.length ||
    !bisJudgeInPanel
  ) {
    throw new Error(
      `Invalid scheduled BIS judge panel for showDay=${args.showDayId}, cluster=${args.clusterId ?? "unknown"}, year=${args.year ?? "unknown"}; assignmentCount=${args.assignments.length}; canonicalGroupsPresent=${[...canonicalGroups].sort().join(",")}; canonicalDistinctJudgeCount=${canonicalJudgeIds.size}; bisJudgeId=${args.bisJudgeId ?? "null"}; bisJudgeInCanonicalPanel=${bisJudgeInPanel}.`
    );
  }

  return { bisJudgeId: args.bisJudgeId! };
}

export async function requirePersistedCompleteShowDayJudgePanelForBis(args: {
  tx: Prisma.TransactionClient;
  showDayId: string;
  bisJudgeId: string | null | undefined;
}): Promise<{ bisJudgeId: string }> {
  const showDay = await args.tx.showDay.findUnique({
    where: { id: args.showDayId },
    select: { clusterId: true, cluster: { select: { year: true } } },
  });
  const assignments = await args.tx.showDayGroupJudgeAssignment.findMany({
    where: { showDayId: args.showDayId },
    select: { groupCode: true, judgeId: true },
  });

  return requireCompleteShowDayJudgePanelForBis({
    showDayId: args.showDayId,
    bisJudgeId: args.bisJudgeId,
    assignments,
    clusterId: showDay?.clusterId,
    year: showDay?.cluster.year,
  });
}

export async function resolveScheduledGroupJudgeForBreed(args: { tx: Prisma.TransactionClient; showDayId: string; breedCode2: string }): Promise<{ judgeId: string; groupCode: string }> {
  const breed = await args.tx.breed.findUnique({ where: { code2: args.breedCode2 }, select: { groupName: true } });
  const showDay = await args.tx.showDay.findUnique({ where: { id: args.showDayId }, select: { clusterId: true, cluster: { select: { year: true } } } });
  if (!breed || !showDay) throw new Error(`Scheduled group judge resolution failed for showDay=${args.showDayId}, breed=${args.breedCode2}.`);
  let groupCode: import("@showring/rules").ShowGroupCode;
  try { groupCode = resolveBreedGroupNameToCanonicalShowGroupCode(breed.groupName); } catch (error) { throw new Error(`Scheduled group judge resolution failed for year=${showDay.cluster.year}, cluster=${showDay.clusterId}, showDay=${args.showDayId}, breed=${args.breedCode2}, groupName=${JSON.stringify(breed.groupName)}: ${error instanceof Error ? error.message : "invalid group"}`); }
  const assignment = await args.tx.showDayGroupJudgeAssignment.findUnique({ where: { showDayId_groupCode: { showDayId: args.showDayId, groupCode } }, select: { judgeId: true } });
  if (!assignment) throw new Error(`Scheduled group judge assignment is missing for year=${showDay.cluster.year}, cluster=${showDay.clusterId}, showDay=${args.showDayId}, breed=${args.breedCode2}, group=${groupCode}, key=${args.showDayId}:${groupCode}.`);
  return { judgeId: assignment.judgeId, groupCode };
}
