import { Prisma } from "@prisma/client";
import { resolveBreedGroupNameToCanonicalShowGroupCode } from "@showring/rules";

export async function resolveScheduledGroupJudgeForBreed(args: { tx: Prisma.TransactionClient; showDayId: string; breedCode2: string }): Promise<{ judgeId: string; groupCode: string }> {
  const breed = await args.tx.breed.findUnique({ where: { code2: args.breedCode2 }, select: { groupName: true } });
  const showDay = await args.tx.showDay.findUnique({ where: { id: args.showDayId }, select: { clusterId: true, cluster: { select: { year: true } } } });
  if (!breed || !showDay) throw new Error(`Scheduled group judge resolution failed for showDay=${args.showDayId}, breed=${args.breedCode2}.`);
  let groupCode: import("@showring/rules").CanonicalShowGroupCode;
  try { groupCode = resolveBreedGroupNameToCanonicalShowGroupCode(breed.groupName); } catch (error) { throw new Error(`Scheduled group judge resolution failed for year=${showDay.cluster.year}, cluster=${showDay.clusterId}, showDay=${args.showDayId}, breed=${args.breedCode2}, groupName=${JSON.stringify(breed.groupName)}: ${error instanceof Error ? error.message : "invalid group"}`); }
  const assignment = await args.tx.showDayGroupJudgeAssignment.findUnique({ where: { showDayId_groupCode: { showDayId: args.showDayId, groupCode } }, select: { judgeId: true } });
  if (!assignment) throw new Error(`Scheduled group judge assignment is missing for year=${showDay.cluster.year}, cluster=${showDay.clusterId}, showDay=${args.showDayId}, breed=${args.breedCode2}, group=${groupCode}, key=${args.showDayId}:${groupCode}.`);
  return { judgeId: assignment.judgeId, groupCode };
}
