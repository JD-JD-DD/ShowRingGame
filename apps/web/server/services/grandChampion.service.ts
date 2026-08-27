import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isChampionOfRecordDog } from "@/lib/dogTitles";
import {
  calculateGrandChampionCompetitionCounts,
  calculateGrandChampionPointsFromCompetition,
  calculateLegacyGrandChampionPointsFromCompetition,
  evaluateGrandChampionQualification,
  getLegacyGrandChampionPointsForCount,
} from "@showring/rules";
import {
  resolveGrandChampionPointSchedules,
  usesDynamicGrandChampionPointSchedule,
} from "@/server/services/grandChampionPointSchedule.service";

const GCH_AWARD_CODES = [
  "BOB",
  "BOS",
  "SELECT_DOG",
  "SELECT_BITCH",
] as const;

type GrandChampionAwardCode = (typeof GCH_AWARD_CODES)[number];
type TransactionClient = Prisma.TransactionClient;
type DbClient = typeof db | TransactionClient;

const GRAND_CHAMPION_CREDIT_RULES_VERSION = "gch-v2-immutable";
const GRAND_CHAMPION_WRITE_CONCURRENCY = 24;

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

async function runBounded<T>(
  values: readonly T[],
  action: (value: T) => PromiseLike<unknown>
) {
  for (let index = 0; index < values.length; index += GRAND_CHAMPION_WRITE_CONCURRENCY) {
    await Promise.all(values.slice(index, index + GRAND_CHAMPION_WRITE_CONCURRENCY).map(action));
  }
}

export function getGrandChampionPointsForCount(countedDogs: number): number {
  return getLegacyGrandChampionPointsForCount(countedDogs);
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
        // ShowRing Game uses one universal GCH point schedule, so BOB counts
        // all eligible Champion specials in the breed competition.
        const countedDogs = championResults.length;
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

export type GrandChampionFinalizationAward = {
  id: string;
  dogId: string;
  breedCode2: string;
  judgeId: string;
  awardCode: string;
  awardGroup: string;
  dogsInCompetition: number | null;
};

/** Builds one GCH-03 snapshot from current ShowDay facts, before they are persisted as credits. */
export function buildGrandChampionCompetitionSnapshot(args: {
  breedCode2: string;
  results: readonly GrandChampionCreditResult[];
  awards: readonly GrandChampionFinalizationAward[];
}) {
  const resultsByDogId = new Map(args.results.map((result) => [result.dogId, result]));
  const winnersDogIds = new Set(
    args.awards.filter((award) => award.awardCode === "WD").map((award) => award.dogId)
  );
  const winnersBitchIds = new Set(
    args.awards.filter((award) => award.awardCode === "WB").map((award) => award.dogId)
  );
  const winnersIds = new Set([...winnersDogIds, ...winnersBitchIds]);
  const bobLevelDogIds = new Set<string>([
    ...args.results.filter((result) => isChampionOfRecordDog(result.dog)).map((result) => result.dogId),
    ...winnersIds,
  ]);
  const qualifyingAwards = new Map(
    args.awards
      .filter((award) => isGrandChampionAwardCode(award.awardCode))
      .map((award) => [award.awardCode as GrandChampionAwardCode, award])
  );
  const awardRecipient = (awardCode: GrandChampionAwardCode) => {
    const award = qualifyingAwards.get(awardCode);
    const result = award ? resultsByDogId.get(award.dogId) : undefined;
    return award && result ? { dogId: award.dogId, sex: result.dog.sex } : undefined;
  };
  const regularCount = (awardCode: "WD" | "WB") =>
    args.awards.find((award) => award.awardCode === awardCode)?.dogsInCompetition ?? 0;
  return {
    breedCode2: args.breedCode2,
    regularCompetitorCounts: { M: regularCount("WD"), F: regularCount("WB") },
    bobLevelCompetitors: [...bobLevelDogIds].map((dogId) => {
      const result = resultsByDogId.get(dogId);
      if (!result) {
        throw new Error("A GCH BOB-level Winner must have a persisted ShowResult.");
      }
      const sameShowDayWinner = winnersIds.has(dogId);
      const championAtFinalization = isChampionOfRecordDog(result.dog);
      return {
        dogId,
        sex: result.dog.sex,
        countsForGchCompetition: championAtFinalization && !sameShowDayWinner,
        eligibleForGchRecipient: championAtFinalization && !sameShowDayWinner,
        championDefeatEligible: championAtFinalization && !sameShowDayWinner,
      };
    }),
    awards: {
      BOB: awardRecipient("BOB"),
      BOS: awardRecipient("BOS"),
      SELECT_DOG: awardRecipient("SELECT_DOG"),
      SELECT_BITCH: awardRecipient("SELECT_BITCH"),
    },
    sameShowDayWinnersDogIds: winnersDogIds,
    sameShowDayWinnersBitchIds: winnersBitchIds,
  };
}

async function recalculateGrandChampionProgressForDogs(args: {
  client: DbClient;
  dogIds: string[];
}) {
  const dogIds = [...new Set(args.dogIds)];
  if (dogIds.length === 0) return;

  const [credits, existingProgresses] = await Promise.all([
    args.client.dogGrandChampionCredit.findMany({
      where: { dogId: { in: dogIds } },
      select: {
        id: true,
        dogId: true,
        showDayId: true,
        pointsAwarded: true,
        isMajor: true,
        countsAsChampionDefeat: true,
        qualifyingChampionOpponentCount: true,
        judgeId: true,
        showAward: { select: { judgeId: true } },
      },
    }),
    args.client.dogTitleProgress.findMany({
      where: { dogId: { in: dogIds } },
      select: {
        dogId: true,
        grandPoints: true,
        grandMajorCount: true,
        grandChampionDefeatShowCount: true,
      },
    }),
  ]);
  const creditsByDogId = new Map<string, typeof credits>();
  for (const credit of credits) {
    const dogCredits = creditsByDogId.get(credit.dogId) ?? [];
    dogCredits.push(credit);
    creditsByDogId.set(credit.dogId, dogCredits);
  }
  const progressByDogId = new Map(
    existingProgresses.map((progress) => [progress.dogId, progress])
  );
  const progressCreates: Prisma.DogTitleProgressCreateManyInput[] = [];
  const progressUpdates: Array<{
    dogId: string;
    grandPoints: number;
    grandMajorCount: number;
    grandChampionDefeatShowCount: number;
  }> = [];

  for (const dogId of dogIds) {
    const dogCredits = creditsByDogId.get(dogId) ?? [];
    for (const credit of dogCredits) {
      if (credit.qualifyingChampionOpponentCount !== null && !credit.judgeId) {
        throw new Error(
          `GCH credit ${credit.id} has corrected provenance but no immutable judgeId.`
        );
      }
    }
    const qualification = evaluateGrandChampionQualification({
      credits: dogCredits.map((credit) => ({
        ...credit,
        judgeId: credit.judgeId ?? credit.showAward?.judgeId ?? null,
      })),
      alreadyGrandChampion: false,
    });
    const existingProgress = progressByDogId.get(dogId);
    const nextProgress = {
      grandPoints: qualification.totalPoints,
      grandMajorCount: qualification.majorShowCount,
      grandChampionDefeatShowCount: qualification.championDefeatShowCount,
    };
    if (!existingProgress) {
      progressCreates.push({ dogId, ...nextProgress });
    } else {
      // Preserve the existing upsert's updatedAt behavior for an existing
      // progress row; only the reads and creation path are batched.
      progressUpdates.push({ dogId, ...nextProgress });
    }
  }

  if (progressCreates.length > 0) {
    await args.client.dogTitleProgress.createMany({
      data: progressCreates,
      skipDuplicates: true,
    });
  }
  await runBounded(progressUpdates, (update) =>
    args.client.dogTitleProgress.update({
      where: { dogId: update.dogId },
      data: {
        grandPoints: update.grandPoints,
        grandMajorCount: update.grandMajorCount,
        grandChampionDefeatShowCount: update.grandChampionDefeatShowCount,
      },
    })
  );
}

async function processGrandChampionCreditsForShowDayWithClient(args: {
  client: DbClient;
  showDayId: string;
  currentEpoch: number;
}): Promise<{ creditsProcessed: number; dogIds: string[] }> {
  const showDay = await args.client.showDay.findUnique({
    where: { id: args.showDayId },
    select: {
      status: true,
      cluster: { select: { year: true, district: true } },
    },
  });
  if (!showDay) throw new Error("Show day not found.");

  // Results-published ShowDays are immutable historical facts. Unfinished
  // finalization retries still use canonical unique-key upserts below.
  if (showDay.status === "RESULTS_PUBLISHED") {
    const credits = await args.client.dogGrandChampionCredit.findMany({
      where: { showDayId: args.showDayId },
      select: { dogId: true },
    });
    return { creditsProcessed: credits.length, dogIds: [...new Set(credits.map((credit) => credit.dogId))] };
  }

  const [results, awards] = await Promise.all([
    args.client.showResult.findMany({
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
    args.client.showAward.findMany({
      where: {
        showDayId: args.showDayId,
        OR: [
          { awardGroup: "BREED", awardCode: { in: [...GCH_AWARD_CODES] } },
          { awardGroup: "WINNERS", awardCode: { in: ["WD", "WB"] } },
        ],
      },
      select: {
        id: true,
        showDayId: true,
        dogId: true,
        breedCode2: true,
        judgeId: true,
        awardCode: true,
        awardGroup: true,
        dogsInCompetition: true,
      },
    }),
  ]);

  const resultsByBreed = new Map<string, typeof results>();
  const awardsByBreed = new Map<string, typeof awards>();
  for (const result of results) {
    const breedResults = resultsByBreed.get(result.breedCode2) ?? [];
    breedResults.push(result);
    resultsByBreed.set(result.breedCode2, breedResults);
  }
  for (const award of awards) {
    const breedAwards = awardsByBreed.get(award.breedCode2) ?? [];
    breedAwards.push(award);
    awardsByBreed.set(award.breedCode2, breedAwards);
  }

  const candidates: Array<{
    dogId: string;
    showDayId: string;
    showAwardId: string;
    awardCode: GrandChampionAwardCode;
    effectiveYear: number;
    district: number;
    breedCode2: string;
    sex: "M" | "F";
    judgeId: string;
    competitionCount: number;
    bobSameSexComparisonCount: number | null;
    qualifyingChampionOpponentCount: number;
    pointsAwarded: number;
    isMajor: boolean;
    defeatedChampionCount: number;
    countsAsChampionDefeat: boolean;
    rulesVersion: string;
    finalizedAtEpoch: number;
    createdAtEpoch: number;
  }> = [];

  for (const [breedCode2, breedAwards] of awardsByBreed) {
    const breedResults = resultsByBreed.get(breedCode2) ?? [];
    const qualifyingAwards = new Map(
      breedAwards
        .filter((award) => isGrandChampionAwardCode(award.awardCode))
        .map((award) => [award.awardCode as GrandChampionAwardCode, award])
    );
    const snapshot = buildGrandChampionCompetitionSnapshot({
      breedCode2,
      results: breedResults,
      awards: breedAwards,
    });
    const competitionResults = calculateGrandChampionCompetitionCounts(snapshot);
    const eligibleSexes = [...new Set(competitionResults.filter((result) => result.recipientEligible).map((result) => result.recipientSex))];
    const schedules = usesDynamicGrandChampionPointSchedule(showDay.cluster.year)
      ? await resolveGrandChampionPointSchedules({
          client: args.client as never,
          effectiveYear: showDay.cluster.year,
          district: showDay.cluster.district,
          breedCode2,
          sexes: eligibleSexes,
        })
      : null;

    for (const competitionResult of competitionResults) {
      if (!competitionResult.recipientEligible) continue;
      const pointResult = schedules
        ? calculateGrandChampionPointsFromCompetition({
            competitionResult,
            thresholds: schedules.get(competitionResult.recipientSex)!.thresholds,
          })
        : calculateLegacyGrandChampionPointsFromCompetition(competitionResult);
      if (pointResult.pointsAwarded <= 0) continue;
      const sourceAward = qualifyingAwards.get(pointResult.awardCode)!;
      candidates.push({
        dogId: pointResult.recipientDogId,
        showDayId: args.showDayId,
        showAwardId: sourceAward.id,
        awardCode: pointResult.awardCode,
        effectiveYear: showDay.cluster.year,
        district: showDay.cluster.district,
        breedCode2,
        sex: pointResult.recipientSex,
        judgeId: sourceAward.judgeId,
        competitionCount: pointResult.competitionCount,
        bobSameSexComparisonCount: pointResult.bobSameSexComparisonCount ?? null,
        qualifyingChampionOpponentCount: pointResult.championDefeatFacts.qualifyingChampionOpponentCount,
        pointsAwarded: pointResult.pointsAwarded,
        isMajor: pointResult.pointsAwarded >= 3,
        defeatedChampionCount: pointResult.championDefeatFacts.qualifyingChampionOpponentCount,
        countsAsChampionDefeat: pointResult.championDefeatFacts.countsAsPotentialChampionDefeat,
        rulesVersion: GRAND_CHAMPION_CREDIT_RULES_VERSION,
        finalizedAtEpoch: args.currentEpoch,
        createdAtEpoch: args.currentEpoch,
      });
    }
  }

  const candidateDogIds = [...new Set(candidates.map((candidate) => candidate.dogId))];
  const existingCredits = await args.client.dogGrandChampionCredit.findMany({
    where: {
      showDayId: args.showDayId,
      dogId: { in: candidateDogIds },
      awardCode: { in: [...GCH_AWARD_CODES] },
    },
    select: { dogId: true, awardCode: true },
  });
  const existingCreditKeys = new Set(
    existingCredits.map((credit) => `${credit.dogId}:${credit.awardCode}`)
  );
  const creditsToCreate = candidates.filter(
    (candidate) => !existingCreditKeys.has(`${candidate.dogId}:${candidate.awardCode}`)
  );
  if (creditsToCreate.length > 0) {
    await args.client.dogGrandChampionCredit.createMany({
      data: creditsToCreate,
      skipDuplicates: true,
    });
  }
  // Preserve canonical upsert correction semantics for rows that already
  // existed before this attempt; new rows take the one-query createMany path.
  await Promise.all(
    candidates
      .filter((candidate) =>
        existingCreditKeys.has(`${candidate.dogId}:${candidate.awardCode}`)
      )
      .map((candidate) =>
        args.client.dogGrandChampionCredit.upsert({
          where: {
            dogId_showDayId_awardCode: {
              dogId: candidate.dogId,
              showDayId: candidate.showDayId,
              awardCode: candidate.awardCode,
            },
          },
          update: candidate,
          create: candidate,
        })
      )
  );

  await recalculateGrandChampionProgressForDogs({
    client: args.client,
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
      client: args.tx,
      showDayId: args.showDayId,
      currentEpoch: args.currentEpoch,
    });
  }

  return processGrandChampionCreditsForShowDayWithClient({
    client: db,
    showDayId: args.showDayId,
    currentEpoch: args.currentEpoch,
  });
}
