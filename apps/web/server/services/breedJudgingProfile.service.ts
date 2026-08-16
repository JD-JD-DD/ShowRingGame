export const BREED_JUDGING_PROFILE_REQUIRED_HEADERS = [
  "Breed", "breedCode2", "Group", "HeadWeight", "ForequartersWeight",
  "HindquartersWeight", "GaitWeight", "CoatWeight", "SizeWeight",
  "TemperamentWeight", "ShowShineWeight", "FeetWeight", "ToplineWeight",
  "RulesVersion", "IsActive", "Source", "Notes",
] as const;

const WEIGHT_COLUMNS = [
  ["HeadWeight", "headWeight"], ["ForequartersWeight", "forequartersWeight"],
  ["HindquartersWeight", "hindquartersWeight"], ["GaitWeight", "gaitWeight"],
  ["CoatWeight", "coatWeight"], ["SizeWeight", "sizeWeight"],
  ["TemperamentWeight", "temperamentWeight"], ["ShowShineWeight", "showShineWeight"],
  ["FeetWeight", "feetWeight"], ["ToplineWeight", "toplineWeight"],
] as const;

export type CanonicalBreedReference = { breed: string; breedCode2: string; group: string };
export type BreedJudgingProfileInput = {
  breed: string; breedCode2: string; group: string;
  headWeight: number; forequartersWeight: number; hindquartersWeight: number;
  gaitWeight: number; coatWeight: number; sizeWeight: number; temperamentWeight: number;
  showShineWeight: number; feetWeight: number; toplineWeight: number;
  rulesVersion: string; isActive: boolean; source: string; notes: string;
};
export type NormalizedBreedJudgingWeights = Omit<BreedJudgingProfileInput,
  "headWeight" | "forequartersWeight" | "hindquartersWeight" | "gaitWeight" | "coatWeight" | "sizeWeight" | "temperamentWeight" | "showShineWeight" | "feetWeight" | "toplineWeight"
> & Record<(typeof WEIGHT_COLUMNS)[number][1], number>;

function parseCsv(csv: string, sourceName: string): Array<Record<string, string>> {
  const rows: string[][] = [[]];
  let value = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else value += character;
      continue;
    }
    if (character === '"') { quoted = true; continue; }
    if (character === ",") { rows[rows.length - 1].push(value); value = ""; continue; }
    if (character === "\n") { rows[rows.length - 1].push(value.replace(/\r$/, "")); value = ""; rows.push([]); continue; }
    value += character;
  }
  if (quoted) throw new Error(`${sourceName}: unterminated quoted CSV field.`);
  rows[rows.length - 1].push(value.replace(/\r$/, ""));
  const nonBlankRows = rows.filter((row) => row.some((field) => field.trim() !== ""));
  if (nonBlankRows.length === 0) throw new Error(`${sourceName}: CSV is empty.`);
  const headers = nonBlankRows[0].map((header) => header.trim());
  if (new Set(headers).size !== headers.length) throw new Error(`${sourceName}: duplicate CSV header.`);
  return nonBlankRows.slice(1).map((row, rowIndex) => {
    if (row.length !== headers.length) throw new Error(`${sourceName}: row ${rowIndex + 2} has ${row.length} columns; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, index) => [header, row[index].trim()]));
  });
}

function requireHeaders(rows: Array<Record<string, string>>, csv: string, sourceName: string, headers: readonly string[]) {
  const firstLine = csv.split(/\r?\n/, 1)[0]?.split(",").map((value) => value.trim()) ?? [];
  for (const header of headers) if (!firstLine.includes(header)) throw new Error(`${sourceName}: missing required header ${header}.`);
  if (firstLine.some((header) => /^Suggested\s*%/i.test(header))) throw new Error(`${sourceName}: packed Suggested % fields are not supported.`);
  return rows;
}

function parseWeight(row: Record<string, string>, column: string, profileLabel: string): number {
  const raw = row[column];
  if (raw === undefined || raw === "") throw new Error(`${profileLabel}: ${column} is required.`);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) throw new Error(`${profileLabel}: ${column} must be a finite numeric percentage; got ${JSON.stringify(raw)}.`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${profileLabel}: ${column} must be finite and >= 0; got ${JSON.stringify(raw)}.`);
  return value;
}

export function parseCanonicalBreedsCsv(csv: string): CanonicalBreedReference[] {
  const rows = requireHeaders(parseCsv(csv, "breeds.csv"), csv, "breeds.csv", ["breed_name", "code2", "group"]);
  return rows.map((row, index) => {
    if (!row.code2 || !row.breed_name || !row.group) throw new Error(`breeds.csv row ${index + 2}: breed_name, code2, and group are required.`);
    return { breed: row.breed_name, breedCode2: row.code2, group: row.group };
  });
}

export function parseBreedJudgingProfilesCsv(csv: string): BreedJudgingProfileInput[] {
  const rows = requireHeaders(parseCsv(csv, "JUDGE-01_Breed_Judging_Profile.csv"), csv, "JUDGE-01_Breed_Judging_Profile.csv", BREED_JUDGING_PROFILE_REQUIRED_HEADERS);
  return rows.map((row, index) => {
    const label = `JUDGE-01_Breed_Judging_Profile.csv row ${index + 2} (${row.breedCode2 || "missing breedCode2"}, ${row.Breed || "missing Breed"})`;
    if (!row.breedCode2 || !row.Breed || !row.Group) throw new Error(`${label}: Breed, breedCode2, and Group are required.`);
    if (!row.RulesVersion) throw new Error(`${label}: RulesVersion is required.`);
    if (row.IsActive !== "TRUE" && row.IsActive !== "FALSE") throw new Error(`${label}: IsActive must be TRUE or FALSE; got ${JSON.stringify(row.IsActive)}.`);
    const weights = Object.fromEntries(WEIGHT_COLUMNS.map(([column, key]) => [key, parseWeight(row, column, label)]));
    const total = Object.values(weights).reduce((sum, value) => sum + Number(value), 0);
    if (Math.abs(total - 100) > 0.01) throw new Error(`${label}: ten explicit weights total ${total}; expected 100.00 ± 0.01.`);
    return { breed: row.Breed, breedCode2: row.breedCode2, group: row.Group, ...weights, rulesVersion: row.RulesVersion, isActive: row.IsActive === "TRUE", source: row.Source, notes: row.Notes } as BreedJudgingProfileInput;
  });
}

export function validateBreedJudgingProfileCoverage(args: { canonicalBreeds: CanonicalBreedReference[]; profiles: BreedJudgingProfileInput[] }): BreedJudgingProfileInput[] {
  const canonicalByCode = new Map<string, CanonicalBreedReference>();
  const canonicalNames = new Set<string>();
  for (const breed of args.canonicalBreeds) {
    if (canonicalByCode.has(breed.breedCode2)) throw new Error(`breeds.csv: duplicate canonical code ${breed.breedCode2}.`);
    if (canonicalNames.has(breed.breed)) throw new Error(`breeds.csv: duplicate canonical Breed ${breed.breed}.`);
    canonicalByCode.set(breed.breedCode2, breed);
    canonicalNames.add(breed.breed);
  }
  const profileByCode = new Map<string, BreedJudgingProfileInput>();
  const profileNames = new Set<string>();
  for (const profile of args.profiles) {
    if (profileByCode.has(profile.breedCode2)) throw new Error(`JUDGE-01_Breed_Judging_Profile.csv: duplicate breedCode2 ${profile.breedCode2}.`);
    if (profileNames.has(profile.breed)) throw new Error(`JUDGE-01_Breed_Judging_Profile.csv: duplicate Breed ${profile.breed}.`);
    profileByCode.set(profile.breedCode2, profile); profileNames.add(profile.breed);
    const canonical = canonicalByCode.get(profile.breedCode2);
    if (!canonical) throw new Error(`JUDGE-01_Breed_Judging_Profile.csv: unknown breedCode2 ${profile.breedCode2} for Breed ${profile.breed}.`);
    if (profile.breed !== canonical.breed) throw new Error(`JUDGE-01_Breed_Judging_Profile.csv: Breed mismatch for ${profile.breedCode2}; expected ${canonical.breed}, got ${profile.breed}.`);
    if (profile.group !== canonical.group) throw new Error(`JUDGE-01_Breed_Judging_Profile.csv: Group mismatch for ${profile.breedCode2}; expected ${canonical.group}, got ${profile.group}.`);
  }
  for (const code of canonicalByCode.keys()) if (!profileByCode.has(code)) throw new Error(`JUDGE-01_Breed_Judging_Profile.csv: missing profile for canonical breedCode2 ${code}.`);
  return args.profiles;
}

/** Derivation is available only from an already parsed-and-validated profile. */
export function normalizeBreedJudgingProfile(profile: BreedJudgingProfileInput): NormalizedBreedJudgingWeights {
  return Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, typeof value === "number" && key.endsWith("Weight") ? value / 100 : value])) as NormalizedBreedJudgingWeights;
}
