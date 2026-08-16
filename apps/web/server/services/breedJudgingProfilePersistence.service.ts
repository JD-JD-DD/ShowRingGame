import type { Prisma, PrismaClient } from "@prisma/client";

import type { BreedJudgingProfileInput } from "./breedJudgingProfile.service";

type ProfileClient = Pick<Prisma.TransactionClient, "breedJudgingProfile">;
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

/** Writes only profiles that have already passed the complete JUDGE-01 CSV gate. */
export async function syncValidatedBreedJudgingProfiles(args: {
  database: ProfileDatabase;
  profiles: BreedJudgingProfileInput[];
}): Promise<{ importedCount: number; activeCount: number }> {
  assertPersistableProfiles(args.profiles);
  return args.database.$transaction(async (tx) => {
    for (const profile of args.profiles) {
      if (profile.isActive) {
        await tx.breedJudgingProfile.updateMany({
          where: { breedCode2: profile.breedCode2, rulesVersion: { not: profile.rulesVersion }, isActive: true },
          data: { isActive: false },
        });
      }
      await tx.breedJudgingProfile.upsert({
        where: { breedCode2_rulesVersion: { breedCode2: profile.breedCode2, rulesVersion: profile.rulesVersion } },
        create: { breedCode2: profile.breedCode2, rulesVersion: profile.rulesVersion, ...toPersistenceData(profile) },
        update: toPersistenceData(profile),
      });
    }
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
