import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isChampionOfRecordDog } from "@/lib/dogTitles";

const GCH_AWARD_CODES = [
  "BOB",
  "BOS",
  "SELECT_DOG",
  "SELECT_BITCH",
] as const;

type GrandChampionAwardCode = (typeof GCH_AWARD_CODES)[number];
type TransactionClient = Prisma.TransactionClient;

type GrandChampionDog = {
  id: string;
  sex: "M" | "F";
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  titleProgress: {
    currentTitleCode: string | null;
  } | null;
};

export type GrandChampionCreditResult = {
  dogId: string;
  breedCode2: string;
  dog: GrandChampionDog;
};

export type GrandChampionCreditAward = {
  id: string;
  showDayId: string;
  dogId: string;
  breedCode2: string;
  awardCode: string;
};

export type GrandChampionCreditCandidate = {
  dogId: string;
  showDayId: string;
  showAwardId: string;
  awardCode: GrandChampionAwardCode;
  pointsAwarded: number;
  isMajor: boolean;
  defeatedChampionCount: number;
  countsAsChampionDefeat: boolean;
  createdAtEpoch: number;
};

function isGrandChampionAwardCode(
  awardCode: string
): awardCode is GrandChampionAwardCode {
  return GCH_AWARD_CODES.includes(awardCode as GrandChampionAwardCode);
}

export function getGrandChampionPointsForCount(countedDogs: number): number {
  return Math.max(0, Math.min(countedDogs - 1, 5));
}

function makeCandidate(args: {
  award: GrandChampionCreditAward;
  awardCode: GrandChampionAwardCode;
  countedDogs: number;
  defeatedChampionCount: number;
  currentEpoch: number;
}): GrandChampionCreditCandidate | null {
  const pointsAwarded = getGrandChampionPointsForCount(args.countedDogs);

  if (pointsAwarded <= 0) {
    return null;
  }

  return {
    dogId: args.award.dogId,
    showDayId: args.award.showDayId,
    showAwardId: args.award.id,
    awardCode: args.awardCode,
    pointsAwarded,
    isMajor: pointsAwarded >= 3,
    defeatedChampionCount: args.defeatedChampionCount,
    countsAsChampionDefeat: args.defeatedChampionCount > 0,
    createdAtEpoch: args.currentEpoch,
  };
}

export function buildGrandChampionCreditCandidates(args: {
  results: GrandChampionCreditResult[];
  awards: GrandChampionCreditAward[];
  currentEpoch: number;
}): GrandChampionCreditCandidate[] {
  const resultsByDogId = new Map(args.results.map((result) => [result.dogId, result]));
  const resultsByBreed = new Map<string, GrandChampionCreditResult[]>();
  const awardsByBreed = new Map<string, GrandChampionCreditAward[]>();

  for (const result of args.results) {
    const breedResults = resultsByBreed.get(result.breedCode2) ?? [];
    breedResults.push(result);
    resultsByBreed.set(result.breedCode2, breedResults);
  }

  for (const award of args.awards) {
    if (!isGrandChampionAwardCode(award.awardCode)) {
      continue;
    }

    const breedAwards = awardsByBreed.get(award.breedCode2) ?? [];
    breedAwards.push(award);
    awardsByBreed.set(award.breedCode2, breedAwards);
  }

  const candidates: GrandChampionCreditCandidate[] = [];

  for (const [breedCode2, breedAwards] of awardsByBreed.entries()) {
    const breedResults = resultsByBreed.get(breedCode2) ?? [];
    const championResults = breedResults.filter((result) =>
      isChampionOfRecordDog(result.dog)
    );
    const championResultsBySex = {
      M: championResults.filter((result) => result.dog.sex === "M"),
      F: championResults.filter((result) => result.dog.sex === "F"),
    };
    const bobAward = breedAwards.find((award) => award.awardCode === "BOB");
    const bosAward = breedAwards.find((award) => award.awardCode === "BOS");
    const excludedSelectDogIdsBySex = {
      M: new Set<string>(),
      F: new Set<string>(),
    };

    for (const award of [bobAward, bosAward]) {
      if (!award) {
        continue;
      }

      const awardedResult = resultsByDogId.get(award.dogId);

      if (awardedResult) {
        excludedSelectDogIdsBySex[awardedResult.dog.sex].add(award.dogId);
      }
    }

    for (const award of breedAwards) {
      if (!isGrandChampionAwardCode(award.awardCode)) {
        continue;
      }

      const awardedResult = resultsByDogId.get(award.dogId);

      if (!awardedResult || !isChampionOfRecordDog(awardedResult.dog)) {
        continue;
      }

      if (award.awardCode === "BOB") {
        const allSexCount = championResults.length;
        const sameSexCount = championResultsBySex[awardedResult.dog.sex].length;
        const allSexPoints = getGrandChampionPointsForCount(allSexCount);
        const sameSexPoints = getGrandChampionPointsForCount(sameSexCount);
        const usesSameSexComparison = sameSexPoints > allSexPoints;
        const countedDogs = usesSameSexComparison ? sameSexCount : allSexCount;
        const candidate = makeCandidate({
          award,
          awardCode: award.awardCode,
          countedDogs,
          defeatedChampionCount: Math.max(0, countedDogs - 1),
          currentEpoch: args.currentEpoch,
        });

        if (candidate) {
          candidates.push(candidate);
        }

        continue;
      }

      if (award.awardCode === "BOS") {
        const countedDogs = championResultsBySex[awardedResult.dog.sex].length;
        const candidate = makeCandidate({
          award,
          awardCode: award.awardCode,
          countedDogs,
          defeatedChampionCount: Math.max(0, countedDogs - 1),
          currentEpoch: args.currentEpoch,
        });

        if (candidate) {
          candidates.push(candidate);
        }

        continue;
      }

      const selectSex = award.awardCode === "SELECT_DOG" ? "M" : "F";

      if (awardedResult.dog.sex !== selectSex) {
        continue;
      }

      const countedDogs = championResultsBySex[selectSex].filter(
        (result) => !excludedSelectDogIdsBySex[selectSex].has(result.dogId)
      ).length;
      const candidate = makeCandidate({
        award,
        awardCode: award.awardCode,
        countedDogs,
        defeatedChampionCount: Math.max(0, countedDogs - 1),
        currentEpoch: args.currentEpoch,
      });

      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

async function recalculateGrandChampionProgressForDogs(args: {
  tx: TransactionClient;
  dogIds: string[];
}) {
  const dogIds = [...new Set(args.dogIds)];

  for (const dogId of dogIds) {
    const credits = await args.tx.dogGrandChampionCredit.findMany({
      where: { dogId },
      select: {
        showDayId: true,
        pointsAwarded: true,
        isMajor: true,
        countsAsChampionDefeat: true,
      },
    });
    const grandPoints = credits.reduce(
      (sum, credit) => sum + credit.pointsAwarded,
      0
    );
    const grandMajorCount = credits.filter((credit) => credit.isMajor).length;
    const grandChampionDefeatShowCount = new Set(
      credits
        .filter((credit) => credit.countsAsChampionDefeat)
        .map((credit) => credit.showDayId)
    ).size;

    await args.tx.dogTitleProgress.upsert({
      where: { dogId },
      update: {
        grandPoints,
        grandMajorCount,
        grandChampionDefeatShowCount,
      },
      create: {
        dogId,
        grandPoints,
        grandMajorCount,
        grandChampionDefeatShowCount,
      },
    });
  }
}

async function processGrandChampionCreditsForShowDayWithClient(args: {
  tx: TransactionClient;
  showDayId: string;
  currentEpoch: number;
}): Promise<{ creditsProcessed: number; dogIds: string[] }> {
  const [results, awards] = await Promise.all([
    args.tx.showResult.findMany({
      where: { showDayId: args.showDayId },
      select: {
        dogId: true,
        breedCode2: true,
        dog: {
          select: {
            id: true,
            sex: true,
            visibleTitlePrefix: true,
            visibleTitleSuffix: true,
            titleProgress: {
              select: {
                currentTitleCode: true,
              },
            },
          },
        },
      },
    }),
    args.tx.showAward.findMany({
      where: {
        showDayId: args.showDayId,
        awardGroup: "BREED",
        awardCode: {
          in: [...GCH_AWARD_CODES],
        },
      },
      select: {
        id: true,
        showDayId: true,
        dogId: true,
        breedCode2: true,
        awardCode: true,
      },
    }),
  ]);
  const candidates = buildGrandChampionCreditCandidates({
    results,
    awards,
    currentEpoch: args.currentEpoch,
  });

  for (const candidate of candidates) {
    await args.tx.dogGrandChampionCredit.upsert({
      where: {
        dogId_showDayId_awardCode: {
          dogId: candidate.dogId,
          showDayId: candidate.showDayId,
          awardCode: candidate.awardCode,
        },
      },
      update: {
        showAwardId: candidate.showAwardId,
        pointsAwarded: candidate.pointsAwarded,
        isMajor: candidate.isMajor,
        defeatedChampionCount: candidate.defeatedChampionCount,
        countsAsChampionDefeat: candidate.countsAsChampionDefeat,
        createdAtEpoch: candidate.createdAtEpoch,
      },
      create: candidate,
    });
  }

  await recalculateGrandChampionProgressForDogs({
    tx: args.tx,
    dogIds: candidates.map((candidate) => candidate.dogId),
  });

  return {
    creditsProcessed: candidates.length,
    dogIds: [...new Set(candidates.map((candidate) => candidate.dogId))],
  };
}

export async function processGrandChampionCreditsForShowDay(args: {
  tx?: TransactionClient;
  showDayId: string;
  currentEpoch: number;
}): Promise<{ creditsProcessed: number; dogIds: string[] }> {
  if (args.tx) {
    return processGrandChampionCreditsForShowDayWithClient({
      tx: args.tx,
      showDayId: args.showDayId,
      currentEpoch: args.currentEpoch,
    });
  }

  return db.$transaction((tx) =>
    processGrandChampionCreditsForShowDayWithClient({
      tx,
      showDayId: args.showDayId,
      currentEpoch: args.currentEpoch,
    })
  );
}
