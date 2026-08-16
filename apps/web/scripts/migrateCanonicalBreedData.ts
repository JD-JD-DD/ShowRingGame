/**
 * Controlled BREED-03 data migration. Default/--dry-run and --verify are read-only.
 * --apply can target any configured DATABASE_URL, including production, so it must be
 * invoked only by the later between-shows runbook after an independently reviewed plan.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

import {
  assertPlanCanApply,
  buildCanonicalBreedMigrationPlan,
  parseCanonicalBreedDataCsv,
  verifyCanonicalBreedData,
  type StoredBreedData,
} from "../server/services/canonicalBreedDataMigration.service";

const BASELINE_REF = "0a76d0f^";
const CSV_PATH = "prisma/data/breeds.csv";
const modes = ["--dry-run", "--apply", "--verify"].filter((mode) => process.argv.includes(mode));
if (modes.length > 1) throw new Error("Choose exactly one of --dry-run, --apply, or --verify.");
const mode = modes[0] ?? "--dry-run";

function loadDatabaseUrlFromEnvFile() {
  if (process.env.DATABASE_URL) return;
  for (const candidate of [join(process.cwd(), ".env"), join(process.cwd(), ".env.local"), join(process.cwd(), "..", "..", ".env")]) {
    if (!existsSync(candidate)) continue;
    const line = readFileSync(candidate, "utf8").split(/\r?\n/).find((value) => value.startsWith("DATABASE_URL="));
    if (line) { process.env.DATABASE_URL = line.replace(/^DATABASE_URL=/, "").replace(/^\"|\"$/g, ""); return; }
  }
}

function canonicalFromRepository() {
  return parseCanonicalBreedDataCsv(readFileSync(join(process.cwd(), CSV_PATH), "utf8"));
}

function baselineFromRepository() {
  return parseCanonicalBreedDataCsv(execFileSync("git", ["show", `${BASELINE_REF}:apps/web/prisma/data/breeds.csv`], { encoding: "utf8" }));
}

async function main() {
  loadDatabaseUrlFromEnvFile();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required even for read-only plan/verify mode.");
  // Canonical validation happens before creating a database client or reading target state.
  const canonical = canonicalFromRepository();
  const baseline = baselineFromRepository();
  const db = new PrismaClient();
  try {
    const target: StoredBreedData[] = await db.breed.findMany({ select: { code2: true, name: true, groupName: true, isActive: true, releaseVersion: true }, orderBy: { code2: "asc" } });
    const plan = buildCanonicalBreedMigrationPlan({ canonical, baseline, target });
    console.log(JSON.stringify({ mode, baseline: BASELINE_REF, canonicalCount: canonical.length, targetCount: target.length, plan }, null, 2));
    assertPlanCanApply(plan);
    if (mode === "--dry-run") return;
    if (mode === "--verify") {
      const verification = verifyCanonicalBreedData({ canonical, target });
      if (!verification.valid) throw new Error("Canonical Breed verification failed; no rows were changed.");
      console.log("Canonical Breed verification passed.");
      return;
    }
    await db.$transaction(async (tx) => {
      for (const row of plan.rows) {
        if (!row.after || row.kinds.includes("NO_CHANGE")) continue;
        const data = { name: row.after.name, groupName: row.after.groupName, isActive: row.after.isActive, releaseVersion: row.after.releaseVersion };
        if (row.kinds.includes("INSERT")) await tx.breed.create({ data: { code2: row.after.code2, ...data } });
        else await tx.breed.update({ where: { code2: row.after.code2 }, data });
      }
    });
    const postflight = await db.breed.findMany({ select: { code2: true, name: true, groupName: true, isActive: true, releaseVersion: true }, orderBy: { code2: "asc" } });
    const verification = verifyCanonicalBreedData({ canonical, target: postflight });
    if (!verification.valid) throw new Error("Postflight verification failed after transaction.");
    console.log("Canonical Breed apply and postflight verification passed.");
  } finally { await db.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
