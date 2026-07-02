import { db } from "@/lib/db";
import {
  backfillKennelRuns,
  formatKennelRunBackfillStats,
} from "@/server/services/kennelRunBackfill.service";

async function main() {
  const stats = await backfillKennelRuns();

  console.log(formatKennelRunBackfillStats(stats));

  if (stats.activeOwnedDogsStillMissingKennelRunId > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Kennel Run backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
