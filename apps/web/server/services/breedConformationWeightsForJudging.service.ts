import type { Prisma } from "@prisma/client";
import {
  deriveBreedConformationCategoryWeights,
  type BreedConformationCategoryWeights,
} from "@showring/rules";

import { toNormalizedBreedJudgingTraitWeights } from "./breedJudgingProfile.service";
import { getActiveBreedJudgingProfile } from "./breedJudgingProfilePersistence.service";

type ProfileClient = Pick<Prisma.TransactionClient, "breedJudgingProfile">;

export class InvalidActiveBreedJudgingProfileError extends Error {}

/**
 * The live judging boundary: persisted active source weights -> JUDGE-01
 * normalized traits -> JUDGE-03 five-category breed emphasis.
 */
export async function getBreedConformationWeightsForJudging(args: {
  client: ProfileClient;
  breedCode2: string;
}): Promise<BreedConformationCategoryWeights> {
  const profile = await getActiveBreedJudgingProfile(args);
  try {
    return deriveBreedConformationCategoryWeights(
      toNormalizedBreedJudgingTraitWeights({
        headWeight: Number(profile.headWeight),
        forequartersWeight: Number(profile.forequartersWeight),
        hindquartersWeight: Number(profile.hindquartersWeight),
        gaitWeight: Number(profile.gaitWeight),
        coatWeight: Number(profile.coatWeight),
        sizeWeight: Number(profile.sizeWeight),
        temperamentWeight: Number(profile.temperamentWeight),
        showShineWeight: Number(profile.showShineWeight),
        feetWeight: Number(profile.feetWeight),
        toplineWeight: Number(profile.toplineWeight),
      })
    );
  } catch (cause) {
    throw new InvalidActiveBreedJudgingProfileError(
      `Invalid active judging profile for ${args.breedCode2}: ${cause instanceof Error ? cause.message : String(cause)}`
    );
  }
}
