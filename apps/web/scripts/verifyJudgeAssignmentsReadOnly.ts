import { Client } from "pg";

type Options = {
  clusterId: string;
  expectedDays?: number;
  weekStartEpoch?: number;
  beforeBlockCount?: number;
};

function parseOptions(argv: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error("Usage: verifyJudgeAssignmentsReadOnly --cluster-id <id> [--expected-days <2|4>] [--week-start-epoch <epoch>] [--before-block-count <count>]");
    }
    if (!["--cluster-id", "--expected-days", "--week-start-epoch", "--before-block-count"].includes(key)) {
      throw new Error(`Unsupported read-only verification option: ${key}`);
    }
    values.set(key, value);
    index += 1;
  }
  const clusterId = values.get("--cluster-id");
  if (!clusterId) throw new Error("--cluster-id is required.");
  const numberValue = (key: string) => {
    const value = values.get(key);
    if (value == null) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) throw new Error(`${key} must be an integer.`);
    return parsed;
  };
  return { clusterId, expectedDays: numberValue("--expected-days"), weekStartEpoch: numberValue("--week-start-epoch"), beforeBlockCount: numberValue("--before-block-count") };
}

function report(name: string, passed: boolean, detail: unknown): boolean {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`, JSON.stringify(detail));
  return passed;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for read-only verification.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const migration = await client.query<{ migration_name: string }>(
      "SELECT migration_name FROM \"_prisma_migrations\" WHERE migration_name = $1 AND finished_at IS NOT NULL",
      ["20260729120000_add_show_day_group_judge_assignments"]
    );
    const schema = await client.query<{ columns: number; indexes: number; foreign_keys: number; unique_constraints: number }>(
      `SELECT
        (SELECT count(*)::int FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ShowDayGroupJudgeAssignment') AS columns,
        (SELECT count(*)::int FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ShowDayGroupJudgeAssignment') AS indexes,
        (SELECT count(*)::int FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'ShowDayGroupJudgeAssignment' AND constraint_type = 'FOREIGN KEY') AS foreign_keys,
        (SELECT count(*)::int FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'ShowDayGroupJudgeAssignment' AND constraint_type = 'UNIQUE') AS unique_constraints`
    );
    const days = await client.query<{
      id: string; day_index: number; judge_id: string; assignments: number; groups: number; judges: number; bis_in_panel: boolean; fingerprint: string; panel: string;
    }>(
      `SELECT sd.id, sd."dayIndex" AS day_index, sd."judgeId" AS judge_id,
        count(a.id)::int AS assignments, count(DISTINCT a."groupCode")::int AS groups,
        count(DISTINCT a."judgeId")::int AS judges, bool_or(a."judgeId" = sd."judgeId") AS bis_in_panel,
        string_agg(a."groupCode"::text || ':' || a."judgeId", ',' ORDER BY a."groupCode") AS fingerprint,
        string_agg(DISTINCT a."judgeId", ',' ORDER BY a."judgeId") AS panel
       FROM "ShowDay" sd LEFT JOIN "ShowDayGroupJudgeAssignment" a ON a."showDayId" = sd.id
       WHERE sd."clusterId" = $1 GROUP BY sd.id, sd."dayIndex", sd."judgeId" ORDER BY sd."dayIndex"`,
      [options.clusterId]
    );
    const panels = await client.query<{ panel: string; group_repeats: number }>(
      `SELECT string_agg(DISTINCT a."judgeId", ',' ORDER BY a."judgeId") AS panel,
        count(*)::int - count(DISTINCT (a."judgeId"::text || ':' || a."groupCode"::text))::int AS group_repeats
       FROM "ShowDay" sd JOIN "ShowDayGroupJudgeAssignment" a ON a."showDayId" = sd.id WHERE sd."clusterId" = $1`,
      [options.clusterId]
    );
    const blocks = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM \"ShowJudgingBlock\" WHERE \"showDayId\" IN (SELECT id FROM \"ShowDay\" WHERE \"clusterId\" = $1)", [options.clusterId]);
    const weekOverlap = options.weekStartEpoch == null ? { rows: [] } : await client.query<{ judge_id: string; clusters: number }>(
      `SELECT a."judgeId" AS judge_id, count(DISTINCT sd."clusterId")::int AS clusters
       FROM "ShowDayGroupJudgeAssignment" a JOIN "ShowDay" sd ON sd.id = a."showDayId" JOIN "ShowCluster" sc ON sc.id = sd."clusterId"
       WHERE sc."startEpoch" >= $1 AND sc."startEpoch" < $1 + 168 GROUP BY a."judgeId" HAVING count(DISTINCT sd."clusterId") > 1`,
      [options.weekStartEpoch]
    );
    let passed = true;
    passed = report("stage-3-migration", migration.rowCount === 1, migration.rows) && passed;
    const schemaRow = schema.rows[0]!;
    passed = report("assignment-schema", schemaRow.columns >= 5 && schemaRow.indexes >= 3 && schemaRow.foreign_keys === 2 && schemaRow.unique_constraints >= 1, schemaRow) && passed;
    passed = report("show-day-assignment-invariants", days.rows.length > 0 && days.rows.every((day) => day.assignments === 7 && day.groups === 7 && day.judges === 7 && day.bis_in_panel), days.rows) && passed;
    passed = report("same-panel-across-cluster", new Set(days.rows.map((day) => day.panel)).size === 1, days.rows.map((day) => ({ id: day.id, panel: day.panel }))) && passed;
    passed = report("canonical-cluster-duration", options.expectedDays == null || days.rows.length === options.expectedDays, { expectedDays: options.expectedDays, actualDays: days.rows.length }) && passed;
    passed = report("stable-panel-and-rotation", panels.rows[0]?.group_repeats === 0, panels.rows[0]) && passed;
    passed = report("weekly-cross-cluster-exclusion", weekOverlap.rows.length === 0, weekOverlap.rows) && passed;
    passed = report("no-new-breed-blocks", options.beforeBlockCount == null || blocks.rows[0]!.count === options.beforeBlockCount, { beforeBlockCount: options.beforeBlockCount, currentBlockCount: blocks.rows[0]!.count }) && passed;
    console.log("ASSIGNMENT_FINGERPRINT", JSON.stringify(days.rows.map((day) => ({ showDayId: day.id, bisJudgeId: day.judge_id, assignments: day.fingerprint }))));
    if (!passed) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => { console.error("Read-only judge assignment verification failed:", error); process.exitCode = 1; });
