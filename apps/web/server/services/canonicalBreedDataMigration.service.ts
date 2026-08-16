import { isValidBreedCode2, resolveBreedGroupNameToCanonicalShowGroupCode } from "@showring/rules";

import { parseCanonicalBreedsCsv, parseCsvRows } from "./breedJudgingProfile.service";

export type CanonicalBreedData = {
  code2: string;
  name: string;
  groupName: string;
  isActive: boolean;
  releaseVersion: number | null;
};

/** Database rows may contain a legacy null Group; canonical CSV rows may not. */
export type StoredBreedData = Omit<CanonicalBreedData, "groupName"> & { groupName: string | null };
export type PlanKind = "INSERT" | "UPDATE_NAME" | "UPDATE_GROUP" | "UPDATE_ACTIVE" | "UPDATE_RELEASE_VERSION" | "NO_CHANGE" | "DATABASE_ONLY" | "IDENTITY_CONFLICT";
export type BreedMigrationPlanRow = { code2: string; name: string; kinds: PlanKind[]; before?: StoredBreedData; after?: CanonicalBreedData };
export type BreedMigrationPlan = { rows: BreedMigrationPlanRow[]; inserts: number; nameUpdates: number; groupUpdates: number; activeUpdates: number; releaseVersionUpdates: number; unchanged: number; databaseOnly: string[]; identityConflicts: string[] };

const CSV_HEADERS = ["breed_name", "code2", "group", "playable", "release_version"] as const;

/** Parses the repository-owned canonical file before any migration plan or write. */
export function parseCanonicalBreedDataCsv(csv: string): CanonicalBreedData[] {
  // Reuse the BREED-01/JUDGE canonical identity parser before reading the migration-only fields.
  parseCanonicalBreedsCsv(csv);
  const rows = parseCsvRows(csv, "breeds.csv");
  const header = csv.split(/\r?\n/, 1)[0]?.split(",").map((value) => value.trim()) ?? [];
  for (const field of CSV_HEADERS) if (!header.includes(field)) throw new Error(`breeds.csv: missing required header ${field}.`);
  const codes = new Set<string>();
  const names = new Set<string>();
  return rows.map((row, index) => {
    const label = `breeds.csv row ${index + 2}`;
    const code2 = row.code2;
    const name = row.breed_name;
    const groupName = row.group;
    if (!isValidBreedCode2(code2)) throw new Error(`${label}: invalid code2 ${JSON.stringify(code2)}.`);
    if (!name || names.has(name)) throw new Error(`${label}: missing or duplicate breed_name ${JSON.stringify(name)}.`);
    if (codes.has(code2)) throw new Error(`${label}: duplicate code2 ${code2}.`);
    resolveBreedGroupNameToCanonicalShowGroupCode(groupName);
    if (row.playable !== "TRUE" && row.playable !== "FALSE") throw new Error(`${label}: playable must be TRUE or FALSE.`);
    if (!/^\d+$/.test(row.release_version)) throw new Error(`${label}: release_version must be a non-negative integer.`);
    const releaseVersion = Number(row.release_version);
    if (!Number.isSafeInteger(releaseVersion)) throw new Error(`${label}: release_version is not a safe integer.`);
    codes.add(code2); names.add(name);
    return { code2, name, groupName, isActive: row.playable === "TRUE", releaseVersion };
  });
}

/**
 * Builds a deterministic, non-mutating plan. A mismatched existing name is safe only
 * when it matches the supplied historical baseline for this code2; otherwise it is an
 * identity conflict and callers must not apply any part of the plan.
 */
export function buildCanonicalBreedMigrationPlan(args: { canonical: CanonicalBreedData[]; target: StoredBreedData[]; baseline?: CanonicalBreedData[] }): BreedMigrationPlan {
  const canonicalByCode = new Map(args.canonical.map((row) => [row.code2, row]));
  const targetByCode = new Map<string, StoredBreedData>();
  const duplicateCodes: string[] = [];
  for (const row of args.target) {
    if (targetByCode.has(row.code2)) duplicateCodes.push(row.code2);
    targetByCode.set(row.code2, row);
  }
  const baselineByCode = new Map(args.baseline?.map((row) => [row.code2, row]) ?? []);
  const rows: BreedMigrationPlanRow[] = [];
  const databaseOnly = [...targetByCode.keys()].filter((code2) => !canonicalByCode.has(code2)).sort();
  const identityConflicts = [...duplicateCodes];
  for (const canonical of [...args.canonical].sort((a, b) => a.code2.localeCompare(b.code2))) {
    const target = targetByCode.get(canonical.code2);
    if (!target) { rows.push({ code2: canonical.code2, name: canonical.name, kinds: ["INSERT"], after: canonical }); continue; }
    const kinds: PlanKind[] = [];
    if (target.name !== canonical.name) {
      if (baselineByCode.get(canonical.code2)?.name === target.name) kinds.push("UPDATE_NAME");
      else { kinds.push("IDENTITY_CONFLICT"); identityConflicts.push(canonical.code2); }
    }
    if (target.groupName !== canonical.groupName) kinds.push("UPDATE_GROUP");
    if (target.isActive !== canonical.isActive) kinds.push("UPDATE_ACTIVE");
    if (target.releaseVersion !== canonical.releaseVersion) kinds.push("UPDATE_RELEASE_VERSION");
    rows.push({ code2: canonical.code2, name: canonical.name, kinds: kinds.length ? kinds : ["NO_CHANGE"], before: target, after: canonical });
  }
  rows.push(...databaseOnly.map((code2) => ({ code2, name: targetByCode.get(code2)!.name, kinds: ["DATABASE_ONLY"] as PlanKind[], before: targetByCode.get(code2) })));
  const count = (kind: PlanKind) => rows.filter((row) => row.kinds.includes(kind)).length;
  return { rows, inserts: count("INSERT"), nameUpdates: count("UPDATE_NAME"), groupUpdates: count("UPDATE_GROUP"), activeUpdates: count("UPDATE_ACTIVE"), releaseVersionUpdates: count("UPDATE_RELEASE_VERSION"), unchanged: count("NO_CHANGE"), databaseOnly, identityConflicts: [...new Set(identityConflicts)].sort() };
}

export function assertPlanCanApply(plan: BreedMigrationPlan) {
  if (plan.databaseOnly.length || plan.identityConflicts.length) {
    throw new Error(`Canonical Breed migration blocked: databaseOnly=${plan.databaseOnly.join(",") || "none"}; identityConflicts=${plan.identityConflicts.join(",") || "none"}.`);
  }
}

export function verifyCanonicalBreedData(args: { canonical: CanonicalBreedData[]; target: StoredBreedData[] }) {
  const plan = buildCanonicalBreedMigrationPlan(args);
  return { plan, valid: plan.inserts === 0 && plan.nameUpdates === 0 && plan.groupUpdates === 0 && plan.activeUpdates === 0 && plan.releaseVersionUpdates === 0 && plan.databaseOnly.length === 0 && plan.identityConflicts.length === 0 };
}
