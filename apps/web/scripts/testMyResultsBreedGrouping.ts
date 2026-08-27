import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd().endsWith(join("apps", "web"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

const loader = source("apps/web/app/my-results/myResults.loader.ts");
const schema = source("apps/web/prisma/schema.prisma");

assert.ok(
  schema.includes("groupJudgeAssignments         ShowDayGroupJudgeAssignment[]"),
  "schema exposes persisted ShowDay group-judge assignments"
);
assert.ok(
  schema.includes("judge   Judge       @relation(fields: [judgeId], references: [id])"),
  "schema keeps the ShowDay BIS judge as a separate persisted relation"
);

assert.ok(
  loader.includes("groupJudgeAssignments: { select: { groupCode: true, judge:"),
  "loader fetches each ShowDay's batched group-judge assignments and judge identity"
);
assert.ok(
  loader.includes("resolveBreedGroupNameToCanonicalShowGroupCode"),
  "loader resolves each breed through the canonical group mapping"
);
assert.ok(
  loader.includes(
    "entry.showDay.groupJudgeAssignments.find((assignment) => assignment.groupCode === groupCode)?.judge"
  ),
  "scheduled group-judge fallback matches the canonical group code"
);
assert.ok(
  loader.includes('if (entry.showResult?.judge) return { judge: entry.showResult.judge, source: "SHOW_RESULT" }'),
  "persisted result judge remains the highest attribution authority"
);
assert.ok(
  loader.includes('if (entry.judgingBlock?.judge) return { judge: entry.judgingBlock.judge, source: "SHOW_JUDGING_BLOCK" }'),
  "judging-block judge remains the second attribution authority"
);
assert.ok(
  loader.includes("bisJudge: dayEntry.showDay.judge"),
  "ShowDay judge remains the BIS attribution rather than the group judge"
);
assert.equal(
  loader.includes("entry.showDay.judgeId === groupCode"),
  false,
  "group judges are never inferred from the ShowDay BIS judge id"
);

console.log("My Results breed-grouping checks passed.");
