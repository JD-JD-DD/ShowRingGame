import {
  BRUCELLOSIS_DISEASE_CODE,
  BRUCELLOSIS_FOUNDATION_INFECTION_RATE,
  BRUCELLOSIS_TEST_VALID_HOURS,
} from "@showring/rules";
import type { Prisma } from "@prisma/client";

export type BrucellosisTestResultCode = "NEGATIVE" | "POSITIVE";

type DiseaseClient = Prisma.TransactionClient;

type InfectionSource = {
  sourceDogId?: string | null;
  sourceBreedingAttemptId?: string | null;
};

export async function isDogInfectedWithBrucellosis(
  client: DiseaseClient,
  dogId: string
): Promise<boolean> {
  const infection = await client.dogInfectiousDiseaseStatus.findUnique({
    where: {
      dogId_diseaseCode: {
        dogId,
        diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      },
    },
    select: {
      status: true,
    },
  });

  return infection?.status === "INFECTED";
}

export async function infectDogWithBrucellosis(
  client: DiseaseClient,
  args: {
    dogId: string;
    currentEpoch: number;
  } & InfectionSource
): Promise<void> {
  await client.dogInfectiousDiseaseStatus.upsert({
    where: {
      dogId_diseaseCode: {
        dogId: args.dogId,
        diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      },
    },
    create: {
      dogId: args.dogId,
      diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      status: "INFECTED",
      infectedAtEpoch: args.currentEpoch,
      sourceDogId: args.sourceDogId ?? null,
      sourceBreedingAttemptId: args.sourceBreedingAttemptId ?? null,
      notes: "Brucellosis infection is permanent in the current ruleset.",
    },
    update: {
      status: "INFECTED",
    },
  });
}

export async function maybeSeedFoundationBrucellosis(
  client: DiseaseClient,
  args: {
    dogId: string;
    currentEpoch: number;
    random01?: () => number;
  }
): Promise<boolean> {
  const random01 = args.random01 ?? Math.random;
  const infected = random01() < BRUCELLOSIS_FOUNDATION_INFECTION_RATE;

  if (infected) {
    await infectDogWithBrucellosis(client, {
      dogId: args.dogId,
      currentEpoch: args.currentEpoch,
      sourceDogId: null,
      sourceBreedingAttemptId: null,
    });
  }

  return infected;
}

export async function getValidNegativeBrucellosisTest(
  client: DiseaseClient,
  args: {
    dogId: string;
    currentEpoch: number;
  }
) {
  if (await isDogInfectedWithBrucellosis(client, args.dogId)) {
    return null;
  }

  return client.infectiousDiseaseTestRecord.findFirst({
    where: {
      dogId: args.dogId,
      diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      resultCode: "NEGATIVE",
      validUntilEpoch: {
        gte: args.currentEpoch,
      },
    },
    orderBy: [{ testedAtEpoch: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      testedAtEpoch: true,
      validUntilEpoch: true,
    },
  });
}

export async function runBrucellosisTest(
  client: DiseaseClient,
  args: {
    dogId: string;
    currentEpoch: number;
    breedingAttemptId?: string | null;
  }
): Promise<{
  id: string;
  resultCode: BrucellosisTestResultCode;
  validUntilEpoch: number | null;
}> {
  const infected = await isDogInfectedWithBrucellosis(client, args.dogId);
  const resultCode: BrucellosisTestResultCode = infected
    ? "POSITIVE"
    : "NEGATIVE";
  const validUntilEpoch =
    resultCode === "NEGATIVE"
      ? args.currentEpoch + BRUCELLOSIS_TEST_VALID_HOURS
      : null;

  const record = await client.infectiousDiseaseTestRecord.create({
    data: {
      dogId: args.dogId,
      diseaseCode: BRUCELLOSIS_DISEASE_CODE,
      resultCode,
      testedAtEpoch: args.currentEpoch,
      validUntilEpoch,
      breedingAttemptId: args.breedingAttemptId ?? null,
      notes:
        resultCode === "POSITIVE"
          ? "Positive brucellosis screen."
          : "Negative brucellosis screen.",
    },
    select: {
      id: true,
      resultCode: true,
      validUntilEpoch: true,
    },
  });

  return {
    ...record,
    resultCode: record.resultCode as BrucellosisTestResultCode,
  };
}

export async function transmitBrucellosisThroughBreeding(
  client: DiseaseClient,
  args: {
    sireId: string;
    damId: string;
    currentEpoch: number;
    breedingAttemptId: string;
  }
): Promise<{
  sireWasInfected: boolean;
  damWasInfected: boolean;
  transmitted: boolean;
}> {
  const [sireWasInfected, damWasInfected] = await Promise.all([
    isDogInfectedWithBrucellosis(client, args.sireId),
    isDogInfectedWithBrucellosis(client, args.damId),
  ]);

  if (sireWasInfected && !damWasInfected) {
    await infectDogWithBrucellosis(client, {
      dogId: args.damId,
      currentEpoch: args.currentEpoch,
      sourceDogId: args.sireId,
      sourceBreedingAttemptId: args.breedingAttemptId,
    });
  }

  if (damWasInfected && !sireWasInfected) {
    await infectDogWithBrucellosis(client, {
      dogId: args.sireId,
      currentEpoch: args.currentEpoch,
      sourceDogId: args.damId,
      sourceBreedingAttemptId: args.breedingAttemptId,
    });
  }

  return {
    sireWasInfected,
    damWasInfected,
    transmitted: sireWasInfected || damWasInfected,
  };
}

export async function infectPuppiesFromDamBrucellosis(
  client: DiseaseClient,
  args: {
    damId: string;
    puppyDogIds: string[];
    currentEpoch: number;
    breedingAttemptId: string;
  }
): Promise<number> {
  const damInfected = await isDogInfectedWithBrucellosis(client, args.damId);

  if (!damInfected) {
    return 0;
  }

  for (const puppyDogId of args.puppyDogIds) {
    await infectDogWithBrucellosis(client, {
      dogId: puppyDogId,
      currentEpoch: args.currentEpoch,
      sourceDogId: args.damId,
      sourceBreedingAttemptId: args.breedingAttemptId,
    });
  }

  return args.puppyDogIds.length;
}
