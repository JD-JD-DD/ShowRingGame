import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import {
  evaluateDamAgainstStudContractRequirements,
  type StudContractRequirementSnapshot,
} from "@/lib/studContractEligibility";
import { getValidNegativeBrucellosisTest } from "@/server/services/infectiousDisease.service";

export async function evaluateCurrentDamAgainstStudContractRequirements(args: {
  damDogId: string;
  currentEpoch: number;
  requirements: StudContractRequirementSnapshot;
  client?: Prisma.TransactionClient;
}) {
  const client = args.client ?? db;
  const [dam, validNegative] = await Promise.all([
    client.dog.findUnique({
      where: { id: args.damDogId },
      select: {
        visibleTitlePrefix: true,
        visibleTitleSuffix: true,
        healthTests: {
          where: { isPublic: true },
          select: {
            id: true,
            testTypeCode: true,
            resultCode: true,
            testedAtEpoch: true,
            createdAt: true,
          },
        },
      },
    }),
    getValidNegativeBrucellosisTest(client, {
      dogId: args.damDogId,
      currentEpoch: args.currentEpoch,
    }),
  ]);
  if (!dam) throw new Error("Dam not found.");

  return evaluateDamAgainstStudContractRequirements(args.requirements, {
    hasValidNegativeBrucellosis: validNegative !== null,
    healthResults: dam.healthTests.map((test) => ({
      healthTestCode: test.testTypeCode,
      resultCode: test.resultCode,
      testedAtEpoch: test.testedAtEpoch,
      createdAtEpoch: test.createdAt.getTime(),
      id: test.id,
    })),
    titleDog: dam,
  });
}

export async function assertDamMeetsStudContractRequirements(args: {
  damDogId: string;
  currentEpoch: number;
  requirements: StudContractRequirementSnapshot;
  client?: Prisma.TransactionClient;
}) {
  const result = await evaluateCurrentDamAgainstStudContractRequirements(args);
  if (!result.eligible) {
    const failure = [
      result.brucellosis,
      ...result.health,
      result.title,
    ].find((item) => !item.eligible);
    throw new Error(failure?.message ?? "This dam does not meet the Stud Contract requirements.");
  }
  return result;
}
