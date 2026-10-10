import { db } from "@/lib/db";
import { createBreedGeneticBackgroundSnapshots } from "@/server/services/breedGeneticBackground.service";

export type CompletedInvitational = {
  year: number;
  endEpoch: number;
};

/** Pure game-time gate: a completed Invitational defines its own annual snapshot epoch. */
export function dueBreedGeneticBackgroundSnapshots(
  completedInvitationals: CompletedInvitational[],
  currentEpoch: number
): CompletedInvitational[] {
  const dueByYear = new Map<number, CompletedInvitational>();
  for (const invitational of completedInvitationals
    .filter(
      (invitational) =>
        Number.isInteger(invitational.year) &&
        invitational.year > 0 &&
        Number.isInteger(invitational.endEpoch) &&
        invitational.endEpoch <= currentEpoch
    )
    .sort((left, right) => left.year - right.year)) {
    dueByYear.set(invitational.year, invitational);
  }
  return [...dueByYear.values()];
}

/**
 * Orchestrates already-finalized Invitational years only. It deliberately does
 * not participate in Invitational publication, so a snapshot failure cannot
 * roll back or invalidate durable show history.
 */
export async function maintainDueBreedGeneticBackgroundSnapshots(args: {
  currentEpoch: number;
}) {
  const completedInvitationals = await db.showCluster.findMany({
    where: {
      id: { startsWith: "invitational-year-" },
      status: "COMPLETE",
      endEpoch: { lte: args.currentEpoch },
    },
    select: { year: true, endEpoch: true },
  });
  const due = dueBreedGeneticBackgroundSnapshots(
    completedInvitationals,
    args.currentEpoch
  );
  const results: Array<{
    gameYear: number;
    snapshotEpoch: number;
    status: "COMPLETED" | "FAILED";
    reports?: Awaited<ReturnType<typeof createBreedGeneticBackgroundSnapshots>>;
    error?: string;
  }> = [];

  for (const invitational of due) {
    try {
      const reports = await createBreedGeneticBackgroundSnapshots({
        gameYear: invitational.year,
        snapshotEpoch: invitational.endEpoch,
        existingSnapshot: "SKIP",
      });
      results.push({
        gameYear: invitational.year,
        snapshotEpoch: invitational.endEpoch,
        status: "COMPLETED",
        reports,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      console.error("breed-genetic-background-scheduled-progression-failed", {
        gameYear: invitational.year,
        snapshotEpoch: invitational.endEpoch,
        error,
      });
      results.push({
        gameYear: invitational.year,
        snapshotEpoch: invitational.endEpoch,
        status: "FAILED",
        error: message,
      });
    }
  }

  return {
    currentEpoch: args.currentEpoch,
    dueInvitationals: due.length,
    completedYears: results.filter((result) => result.status === "COMPLETED").length,
    failedYears: results.filter((result) => result.status === "FAILED").length,
    results,
  };
}
