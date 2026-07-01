import {
  executeYear13RegularShowRepair,
  getExecuteAuthorizationBlockers,
  getYear13RegularShowRepairPlan,
} from "../server/services/year13RegularShowRepair.service";

type Mode = "dry-run" | "execute";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));

  return match?.slice(prefix.length);
}

function getMode(): Mode {
  const mode = argValue("mode") ?? "dry-run";

  if (mode === "dry-run" || mode === "execute") {
    return mode;
  }

  throw new Error("--mode must be dry-run or execute.");
}

function summarizePlan(plan: Awaited<ReturnType<typeof getYear13RegularShowRepairPlan>>) {
  return {
    csv: plan.csv,
    totals: plan.totals,
    refundByType: plan.refundByType,
    refundByKennel: plan.refundByKennel,
    repairActions: plan.repairActions,
    blockers: plan.blockers,
    executeWouldBeAllowed: plan.executeWouldBeAllowed,
    clustersRecommendedForArchiveBeforeReplacement: plan.clusters.map((cluster) => ({
      id: cluster.id,
      weekInYear: cluster.weekInYear,
      slotIndex: cluster.slotIndex,
      category: cluster.category,
      counts: cluster.counts,
    })),
    clustersRecommendedForCsvRegeneration: plan.missingCsvTargetClusters,
  };
}

async function main() {
  const mode = getMode();

  if (mode === "execute") {
    const authBlockers = getExecuteAuthorizationBlockers({
      mode,
      confirmation: argValue("confirm"),
      executeSecret: process.env.YEAR_13_REPAIR_EXECUTE_SECRET,
      jobSecret: process.env.SHOWRING_JOBS_SECRET,
    });

    if (authBlockers.length > 0) {
      throw new Error(authBlockers.join(" "));
    }

    const result = await executeYear13RegularShowRepair({
      confirmation: argValue("confirm"),
      executeSecret: process.env.YEAR_13_REPAIR_EXECUTE_SECRET,
      jobSecret: process.env.SHOWRING_JOBS_SECRET,
    });

    console.log(
      JSON.stringify(
        {
          mode,
          executed: true,
          refundedAmount: result.refundedAmount,
          archivedClusterCount: result.archivedClusterCount,
          createdReplacementClusterCount: result.createdReplacementClusterCount,
          plan: summarizePlan(result.plan),
        },
        null,
        2
      )
    );
    return;
  }

  const plan = await getYear13RegularShowRepairPlan();

  console.log(
    JSON.stringify(
      {
        mode,
        executed: false,
        plan: summarizePlan(plan),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
