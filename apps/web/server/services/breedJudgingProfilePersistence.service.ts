import { Prisma, type PrismaClient } from "@prisma/client";

import type { BreedJudgingProfileInput } from "./breedJudgingProfile.service";

type ProfileClient = Pick<Prisma.TransactionClient, "breedJudgingProfile">;
type ProfileMutationClient = Pick<Prisma.TransactionClient, "breedJudgingProfile" | "$executeRaw">;
type ProfileDatabase = Pick<PrismaClient, "$transaction">;

export class MissingBreedJudgingProfileError extends Error {}
export class AmbiguousActiveBreedJudgingProfileError extends Error {}

function toPersistenceData(profile: BreedJudgingProfileInput) {
  return {
    isActive: profile.isActive,
    headWeight: profile.headWeight,
    forequartersWeight: profile.forequartersWeight,
    hindquartersWeight: profile.hindquartersWeight,
    gaitWeight: profile.gaitWeight,
    coatWeight: profile.coatWeight,
    sizeWeight: profile.sizeWeight,
    temperamentWeight: profile.temperamentWeight,
    showShineWeight: profile.showShineWeight,
    feetWeight: profile.feetWeight,
    toplineWeight: profile.toplineWeight,
    source: profile.source || null,
    notes: profile.notes || null,
  };
}

function assertPersistableProfiles(profiles: BreedJudgingProfileInput[]) {
  const identities = new Set<string>();
  for (const profile of profiles) {
    const identity = `${profile.breedCode2}:${profile.rulesVersion}`;
    if (!profile.breedCode2 || !profile.rulesVersion || identities.has(identity)) {
      throw new Error(`Invalid duplicate or blank persisted profile identity ${identity}.`);
    }
    identities.add(identity);
    const total = [profile.headWeight, profile.forequartersWeight, profile.hindquartersWeight, profile.gaitWeight, profile.coatWeight, profile.sizeWeight, profile.temperamentWeight, profile.showShineWeight, profile.feetWeight, profile.toplineWeight].reduce((sum, value) => {
      if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid persisted judging weight for ${profile.breedCode2}.`);
      return sum + value;
    }, 0);
    if (Math.abs(total - 100) > 0.01) throw new Error(`Invalid persisted judging total for ${profile.breedCode2}: ${total}.`);
  }
}

type PersistenceRow = BreedJudgingProfileInput & { persistedIsActive: boolean };

function buildPersistencePlan(profiles: BreedJudgingProfileInput[]) {
  assertPersistableProfiles(profiles);
  const lastActiveProfileIndexByBreed = new Map<string, number>();
  profiles.forEach((profile, index) => {
    if (profile.isActive) lastActiveProfileIndexByBreed.set(profile.breedCode2, index);
  });

  return {
    activeBreedCodes: [...lastActiveProfileIndexByBreed.keys()],
    rows: profiles.map((profile, index): PersistenceRow => ({
      ...profile,
      // Preserve sequential upsert semantics if a caller supplies multiple active
      // versions for one Breed: the final active profile remains the sole active one.
      persistedIsActive: profile.isActive && lastActiveProfileIndexByBreed.get(profile.breedCode2) === index,
    })),
  };
}

function toPersistedData(row: PersistenceRow) {
  return { ...toPersistenceData(row), isActive: row.persistedIsActive };
}

function bulkProfileUpdate(rows: PersistenceRow[]) {
  const values = rows.map((row) => Prisma.sql`(
    ${row.breedCode2}, ${row.rulesVersion}, ${row.persistedIsActive},
    ${row.headWeight}, ${row.forequartersWeight}, ${row.hindquartersWeight}, ${row.gaitWeight},
    ${row.coatWeight}, ${row.sizeWeight}, ${row.temperamentWeight}, ${row.showShineWeight},
    ${row.feetWeight}, ${row.toplineWeight}, ${row.source || null}, ${row.notes || null}
  )`);
  return Prisma.sql`
    UPDATE "BreedJudgingProfile" AS target
    SET
      "isActive" = source."isActive",
      "headWeight" = source."headWeight",
      "forequartersWeight" = source."forequartersWeight",
      "hindquartersWeight" = source."hindquartersWeight",
      "gaitWeight" = source."gaitWeight",
      "coatWeight" = source."coatWeight",
      "sizeWeight" = source."sizeWeight",
      "temperamentWeight" = source."temperamentWeight",
      "showShineWeight" = source."showShineWeight",
      "feetWeight" = source."feetWeight",
      "toplineWeight" = source."toplineWeight",
      "source" = source."source",
      "notes" = source."notes",
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${Prisma.join(values)}) AS source(
      "breedCode2", "rulesVersion", "isActive",
      "headWeight", "forequartersWeight", "hindquartersWeight", "gaitWeight",
      "coatWeight", "sizeWeight", "temperamentWeight", "showShineWeight",
      "feetWeight", "toplineWeight", "source", "notes"
    )
    WHERE target."breedCode2" = source."breedCode2"
      AND target."rulesVersion" = source."rulesVersion"
  `;
}

/** Writes only profiles that have already passed the complete JUDGE-01 CSV gate. */
export async function syncValidatedBreedJudgingProfiles(args: {
  database: ProfileDatabase;
  profiles: BreedJudgingProfileInput[];
}): Promise<{ importedCount: number; activeCount: number }> {
  const plan = buildPersistencePlan(args.profiles);
  return args.database.$transaction(async (tx) => {
    const mutationClient = tx as ProfileMutationClient;
    if (plan.activeBreedCodes.length > 0) {
      await mutationClient.breedJudgingProfile.updateMany({
        where: { breedCode2: { in: plan.activeBreedCodes }, isActive: true },
        data: { isActive: false },
      });
    }
    await mutationClient.breedJudgingProfile.createMany({
      data: plan.rows.map((row) => ({
        breedCode2: row.breedCode2,
        rulesVersion: row.rulesVersion,
        ...toPersistedData(row),
      })),
      skipDuplicates: true,
    });
    await mutationClient.$executeRaw(bulkProfileUpdate(plan.rows));
    return { importedCount: args.profiles.length, activeCount: args.profiles.filter((profile) => profile.isActive).length };
  });
}

export async function getBreedJudgingProfile(args: {
  client: ProfileClient;
  breedCode2: string;
  rulesVersion: string;
}) {
  const profile = await args.client.breedJudgingProfile.findUnique({
    where: { breedCode2_rulesVersion: { breedCode2: args.breedCode2, rulesVersion: args.rulesVersion } },
  });
  if (!profile) throw new MissingBreedJudgingProfileError(`No judging profile for ${args.breedCode2} / ${args.rulesVersion}.`);
  return profile;
}

export async function getActiveBreedJudgingProfile(args: { client: ProfileClient; breedCode2: string }) {
  const profiles = await args.client.breedJudgingProfile.findMany({ where: { breedCode2: args.breedCode2, isActive: true } });
  if (profiles.length === 0) throw new MissingBreedJudgingProfileError(`No active judging profile for ${args.breedCode2}.`);
  if (profiles.length > 1) throw new AmbiguousActiveBreedJudgingProfileError(`Multiple active judging profiles for ${args.breedCode2}.`);
  return profiles[0];
}
