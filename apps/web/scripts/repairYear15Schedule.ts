import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { generateFixedShowClustersForYear } from "../server/services/annualShowSchedule.service";

const TARGET_YEAR = 15;
const apply = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm-production-year=15");
if (apply && !confirmed) throw new Error("--apply requires --confirm-production-year=15 before any database connection.");
if (apply) throw new Error("Year 15 apply mode is intentionally unavailable in this dry-run-only stage.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the read-only dry-run.");

async function main() {
  console.log("Year 15 schedule repair mode: READ-ONLY DRY RUN. No writes will be issued.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const canonical = new Map(generateFixedShowClustersForYear(TARGET_YEAR).map((cluster) => [cluster.generatedClusterId!, cluster]));
    const clusters = await client.query<{
      id: string; name: string; district: number; startEpoch: number; endEpoch: number; entryOpenEpoch: number; entryCloseEpoch: number;
      show_day_count: number; assignment_count: number; entry_count: number; block_count: number; result_count: number; award_count: number;
    }>(`SELECT c.id, c.name, c.district, c."startEpoch" AS "startEpoch", c."endEpoch" AS "endEpoch", c."entryOpenEpoch" AS "entryOpenEpoch", c."entryCloseEpoch" AS "entryCloseEpoch",
      (SELECT count(*)::int FROM "ShowDay" sd WHERE sd."clusterId" = c.id) AS show_day_count,
      (SELECT count(*)::int FROM "ShowDayGroupJudgeAssignment" a JOIN "ShowDay" sd ON sd.id=a."showDayId" WHERE sd."clusterId"=c.id) AS assignment_count,
      (SELECT count(*)::int FROM "ShowEntry" e JOIN "ShowDay" sd ON sd.id=e."showDayId" WHERE sd."clusterId"=c.id) AS entry_count,
      (SELECT count(*)::int FROM "ShowJudgingBlock" b JOIN "ShowDay" sd ON sd.id=b."showDayId" WHERE sd."clusterId"=c.id) AS block_count,
      (SELECT count(*)::int FROM "ShowResult" r JOIN "ShowDay" sd ON sd.id=r."showDayId" WHERE sd."clusterId"=c.id) AS result_count,
      (SELECT count(*)::int FROM "ShowAward" a JOIN "ShowDay" sd ON sd.id=a."showDayId" WHERE sd."clusterId"=c.id) AS award_count
      FROM "ShowCluster" c WHERE c.year=$1 AND c.id LIKE 'generated-year-15-%' ORDER BY c."startEpoch", c.id`, [TARGET_YEAR]);
    const plans = clusters.rows.map((cluster) => {
      const expected = canonical.get(cluster.id);
      const structuralCorrect = Boolean(expected) && cluster.name === expected!.name && cluster.district === expected!.district && cluster.startEpoch === expected!.startEpoch && cluster.endEpoch === expected!.endEpoch && cluster.show_day_count === expected!.showDayEpochs.length;
      const durationState = !expected ? "UNMATCHED_CANONICAL_ROW" : structuralCorrect ? "STRUCTURALLY_CORRECT" : cluster.show_day_count > expected.showDayEpochs.length ? "FOUR_DAY_TO_TWO_DAY" : cluster.show_day_count < expected.showDayEpochs.length ? "TWO_DAY_TO_FOUR_DAY" : "OTHER_STRUCTURAL_MISMATCH";
      const protectedState = cluster.entry_count + cluster.block_count + cluster.result_count + cluster.award_count > 0;
      const judgeState = cluster.assignment_count === cluster.show_day_count * 8 ? "JUDGE_PLAN_VALID_UNCHANGED" : cluster.assignment_count === 0 ? "JUDGE_PLAN_MISSING" : "JUDGE_PLAN_INCOMPLETE";
      return { clusterId: cluster.id, durationState, judgeState, safety: !expected ? "UNMATCHED_OR_INVALID" : protectedState ? "REQUIRES_DETAILED_RECONCILIATION" : structuralCorrect && judgeState === "JUDGE_PLAN_VALID_UNCHANGED" ? "SAFE_UNCHANGED" : "SAFE_REPAIRABLE", counts: cluster };
    });
    const week52 = await client.query(`SELECT id FROM "ShowCluster" WHERE year=$1 AND id=$2`, [TARGET_YEAR, `invitational-year-${TARGET_YEAR}`]);
    const noRepairRequired = plans.every((plan) => plan.safety === "SAFE_UNCHANGED");
    const report = { metadata: { executedAt: new Date().toISOString(), mode: "DRY_RUN", targetYear: TARGET_YEAR, prismaWritesCalled: 0 }, resultClassification: noRepairRequired ? "NO_REPAIR_REQUIRED" : "REPAIR_REVIEW_REQUIRED", canonicalSummary: { ordinaryClusters: canonical.size }, databaseSummary: { generatedOrdinaryClusters: clusters.rows.length, generatedShowDays: clusters.rows.reduce((sum, row) => sum + row.show_day_count, 0), assignmentRows: clusters.rows.reduce((sum, row) => sum + row.assignment_count, 0), entryRows: clusters.rows.reduce((sum, row) => sum + row.entry_count, 0), blockRows: clusters.rows.reduce((sum, row) => sum + row.block_count, 0), week52: week52.rowCount ? "PRESENT_AUDIT_ONLY" : "ABSENT_AS_EXPECTED" }, clusterPlans: plans, blockers: plans.filter((plan) => plan.safety !== "SAFE_UNCHANGED" && plan.safety !== "SAFE_REPAIRABLE").map((plan) => plan.clusterId), mutationSummary: { applyAvailable: false, writesPlanned: 0 } };
    const outputPath = path.resolve(process.cwd(), "artifacts", "year15-schedule-dry-run.json");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ outputPath, ...report.databaseSummary, blockers: report.blockers.length }, null, 2));
  } finally { await client.end(); }
}
main().catch((error) => { console.error("Year 15 dry-run failed:", error); process.exitCode = 1; });
