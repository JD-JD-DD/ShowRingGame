import { db } from "@/lib/db";
import {
  formatKennelRunResetStats,
  kennelRunResetHasIntegrityFailures,
  resetKennelRunsToUncategorized,
} from "@/server/services/kennelRunBackfill.service";

async function main() {
  const stats = await resetKennelRunsToUncategorized();

  console.log(formatKennelRunResetStats(stats));

  if (kennelRunResetHasIntegrityFailures(stats)) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Kennel Run reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
