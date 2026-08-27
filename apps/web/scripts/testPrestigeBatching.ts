import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "apps/web/server/services/prestige.service.ts"), "utf8");
const start = source.indexOf("async function syncYearlyPrestigeStats");
const end = source.indexOf("export async function refreshPrestigeStatsForShowDay", start);
assert.ok(start >= 0 && end > start);
const yearly = source.slice(start, end);

assert.match(yearly, /dogShowPrestigeCredit\.groupBy/);
assert.match(yearly, /dogYearlyPrestigeStat\.findMany\(\{\s*where: \{ dogId: \{ in: dogIds \}, gameYear: args\.gameYear \}/);
assert.match(yearly, /dogYearlyPrestigeStat\.createMany/);
assert.match(yearly, /skipDuplicates: true/);
assert.match(yearly, /dogYearlyPrestigeStat\.deleteMany/);
assert.match(yearly, /PRESTIGE_WRITE_CONCURRENCY/);
assert.match(yearly, /Promise\.all\(rowsToUpdate\.slice/);
assert.doesNotMatch(yearly, /for \(const dogId of dogIds\) \{\s*const rollup/);
console.log("Prestige batching regression checks passed.");
