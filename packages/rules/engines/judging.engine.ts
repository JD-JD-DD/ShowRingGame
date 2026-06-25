// how dogs are scored

import type { Dog, DogTraits } from "./dog.engine";
import type { Judge } from "./judge.engine";
import {
  CATEGORY_TRAIT_MAP,
  DOG_DAY_VARIANCE,
  GENETIC_JUDGING_CATEGORIES,
  JUDGING_CATEGORIES,
  RING_RANDOMNESS,
  type JudgingCategory,
} from "../constants/judging.constants";
import { deriveConditioningHandlingScore } from "./conditioning.engine";
import { deriveHealthAdjustedExpressedTraits } from "./healthExpression.engine";
import { applyPresentationModifiersToCharacteristics } from "./presentation.engine";
import { scoreValueAgainstIdeal } from "./idealScoring.engine";

export type ShowCharacteristics = Record<JudgingCategory, number>;
export type WeightedCategoryScores = Record<JudgingCategory, number>;

export type JudgedDogBreakdown = {
  dogId: string;
  regNumber: string;
  characteristics: ShowCharacteristics;
  weightedCategoryScores: WeightedCategoryScores;
  baseScore: number;
  dogDayAdjustment: number;
  ringRandomnessAdjustment: number;
  finalScore: number;
  tieBreakRoll: number;
};

export type JudgingEntry = {
  showEntryId?: string;
  dog: Dog;
  isChampion?: boolean;
};

export type JudgedEntryResult = JudgedDogBreakdown & {
  showEntryId?: string;
  finalRank: number;
  placementCode: string;
};

export type ShowAwardCode =
  | "1"
  | "2"
  | "3"
  | "4"
  | "WD"
  | "RWD"
  | "WB"
  | "RWB"
  | "BOW"
  | "BOB"
  | "BOS"
  | "SELECT_DOG"
  | "SELECT_BITCH"
  | "AOM"
  | "G1"
  | "G2"
  | "G3"
  | "G4"
  | "BIS"
  | "RBIS";

export type ShowAwardGroup =
  | "DOG_CLASS"
  | "BITCH_CLASS"
  | "WINNERS"
  | "BREED"
  | "GROUP"
  | "BEST_IN_SHOW";

export type JudgedShowAward = {
  showEntryId?: string;
  dogId: string;
  awardCode: ShowAwardCode;
  awardGroup: ShowAwardGroup;
  sex: "M" | "F" | null;
  rank: number | null;
  pointsAwarded: number;
  isMajor: boolean;
  dogsInCompetition: number | null;
};

export type JudgedBreedBlock = {
  results: JudgedEntryResult[];
  awards: JudgedShowAward[];
};

type ChampionshipPointScheduleRow = {
  dogsInCompetition: number;
  points: number;
};

const DEFAULT_CHAMPIONSHIP_POINT_SCHEDULE: ChampionshipPointScheduleRow[] = [
  { dogsInCompetition: 6, points: 5 },
  { dogsInCompetition: 5, points: 4 },
  { dogsInCompetition: 4, points: 3 },
  { dogsInCompetition: 3, points: 2 },
  { dogsInCompetition: 2, points: 1 },
];

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function roundScore(value: number): number {
  return Number(value.toFixed(2));
}

function centeredPercentAdjustment(
  baseScore: number,
  percent: number,
  random01: () => number
): number {
  const multiplier = (random01() * 2 - 1) * percent;
  return roundScore(baseScore * multiplier);
}

export function deriveShowCharacteristicsFromTraits(
  traits: DogTraits
): ShowCharacteristics {
  const result = {} as ShowCharacteristics;

  for (const category of GENETIC_JUDGING_CATEGORIES) {
    const traitKeys = CATEGORY_TRAIT_MAP[category];
    const values = traitKeys.map((trait) => traits[trait]);
    result[category] = roundScore(average(values));
  }

  result.CONDITIONING_HANDLING = deriveConditioningHandlingScore();

  return result;
}

export function scoreDogByJudgeWeights(args: {
  dog: Dog;
  judge: Judge;
  showEpoch?: number;
  random01?: () => number;
}): JudgedDogBreakdown {
  const { dog, judge } = args;
  const random01 = args.random01 ?? Math.random;

  const expressedTraits = deriveHealthAdjustedExpressedTraits({
    storedTraits: dog.traits,
    phenotypeHealthTruths: dog.presentation?.phenotypeHealthTruths,
    phenotypeHealthResults: dog.presentation?.phenotypeHealthResults,
  });
  const baseCharacteristics = deriveShowCharacteristicsFromTraits(
    expressedTraits
  );
  baseCharacteristics.CONDITIONING_HANDLING = deriveConditioningHandlingScore(
    dog.presentation
  );
  const characteristics =
    args.showEpoch == null
      ? baseCharacteristics
      : applyPresentationModifiersToCharacteristics({
          characteristics: baseCharacteristics,
          dog,
          showEpoch: args.showEpoch,
        }).characteristics;
  const weightedCategoryScores = {} as WeightedCategoryScores;

  let baseScore = 0;

  for (const category of JUDGING_CATEGORIES) {
    const idealScore = scoreValueAgainstIdeal(characteristics[category]);
    const categoryScore =
      idealScore * judge.categoryWeights[category];

    weightedCategoryScores[category] = roundScore(categoryScore);
    baseScore += categoryScore;
  }

  const roundedBaseScore = roundScore(baseScore);
  const dogDayAdjustment = centeredPercentAdjustment(
    roundedBaseScore,
    DOG_DAY_VARIANCE,
    random01
  );
  const ringRandomnessAdjustment = centeredPercentAdjustment(
    roundedBaseScore,
    RING_RANDOMNESS,
    random01
  );
  const finalScore = roundScore(
    roundedBaseScore + dogDayAdjustment + ringRandomnessAdjustment
  );

  return {
    dogId: dog.dogId,
    regNumber: dog.regNumber,
    characteristics,
    weightedCategoryScores,
    baseScore: roundedBaseScore,
    dogDayAdjustment,
    ringRandomnessAdjustment,
    finalScore,
    tieBreakRoll: random01(),
  };
}

function compareJudgedDogs(
  a: JudgedDogBreakdown,
  b: JudgedDogBreakdown
): number {
  if (b.finalScore !== a.finalScore) {
    return b.finalScore - a.finalScore;
  }

  if (
    b.weightedCategoryScores.STRUCTURE_BALANCE !==
    a.weightedCategoryScores.STRUCTURE_BALANCE
  ) {
    return (
      b.weightedCategoryScores.STRUCTURE_BALANCE -
      a.weightedCategoryScores.STRUCTURE_BALANCE
    );
  }

  if (b.weightedCategoryScores.MOVEMENT !== a.weightedCategoryScores.MOVEMENT) {
    return b.weightedCategoryScores.MOVEMENT - a.weightedCategoryScores.MOVEMENT;
  }

  return b.tieBreakRoll - a.tieBreakRoll;
}

export function judgeBreedEntries(args: {
  entries: JudgingEntry[];
  judge: Judge;
  showEpoch?: number;
  random01?: () => number;
}): JudgedEntryResult[] {
  const random01 = args.random01 ?? Math.random;

  return args.entries
    .map((entry) => ({
      showEntryId: entry.showEntryId,
      ...scoreDogByJudgeWeights({
        dog: entry.dog,
        judge: args.judge,
        showEpoch: args.showEpoch,
        random01,
      }),
    }))
    .sort(compareJudgedDogs)
    .map((result, index) => ({
      ...result,
      finalRank: index + 1,
      placementCode: String(index + 1),
    }));
}

export function getChampionshipPointsForCompetition(
  dogsInCompetition: number
): number {
  return (
    DEFAULT_CHAMPIONSHIP_POINT_SCHEDULE.find(
      (row) => dogsInCompetition >= row.dogsInCompetition
    )?.points ?? 0
  );
}

function makeAward(args: {
  result: JudgedEntryResult;
  awardCode: ShowAwardCode;
  awardGroup: ShowAwardGroup;
  sex: "M" | "F" | null;
  rank: number | null;
  pointsAwarded?: number;
  dogsInCompetition?: number | null;
}): JudgedShowAward {
  const pointsAwarded = args.pointsAwarded ?? 0;

  return {
    showEntryId: args.result.showEntryId,
    dogId: args.result.dogId,
    awardCode: args.awardCode,
    awardGroup: args.awardGroup,
    sex: args.sex,
    rank: args.rank,
    pointsAwarded,
    isMajor: pointsAwarded >= 3,
    dogsInCompetition: args.dogsInCompetition ?? null,
  };
}

function buildSexClassAwards(args: {
  results: JudgedEntryResult[];
  sex: "M" | "F";
}): JudgedShowAward[] {
  const { results, sex } = args;
  const awardGroup: ShowAwardGroup =
    sex === "M" ? "DOG_CLASS" : "BITCH_CLASS";
  const awards: JudgedShowAward[] = [];

  for (const [index, result] of results.slice(0, 4).entries()) {
    const rank = index + 1;

    awards.push(
      makeAward({
        result,
        awardCode: String(rank) as ShowAwardCode,
        awardGroup,
        sex,
        rank,
        dogsInCompetition: results.length,
      })
    );
  }

  return awards;
}

function buildWinnersAwards(args: {
  results: JudgedEntryResult[];
  sex: "M" | "F";
}): JudgedShowAward[] {
  const { results, sex } = args;
  const winner = results[0];
  const reserve = results[1];
  const awards: JudgedShowAward[] = [];

  if (winner) {
    awards.push(
      makeAward({
        result: winner,
        awardCode: sex === "M" ? "WD" : "WB",
        awardGroup: "WINNERS",
        sex,
        rank: 1,
        pointsAwarded: getChampionshipPointsForCompetition(results.length),
        dogsInCompetition: results.length,
      })
    );
  }

  if (reserve) {
    awards.push(
      makeAward({
        result: reserve,
        awardCode: sex === "M" ? "RWD" : "RWB",
        awardGroup: "WINNERS",
        sex,
        rank: 2,
        dogsInCompetition: results.length,
      })
    );
  }

  return awards;
}

function buildBreedAwards(args: {
  entries: JudgingEntry[];
  maleClassResults: JudgedEntryResult[];
  femaleClassResults: JudgedEntryResult[];
  breedResults: JudgedEntryResult[];
}): JudgedShowAward[] {
  const winnersCandidates = [
    args.maleClassResults[0],
    args.femaleClassResults[0],
  ].filter((result): result is JudgedEntryResult => Boolean(result));
  const bestOfWinners = [...winnersCandidates].sort(compareJudgedDogs)[0];
  const breedCandidates = [
    ...args.breedResults,
    ...winnersCandidates.filter(
      (winner) =>
        !args.breedResults.some((result) => result.dogId === winner.dogId)
    ),
  ].sort(compareJudgedDogs);
  const bestOfBreed = breedCandidates[0];
  const bestOfBreedSex = bestOfBreed
    ? entrySexForResult(args.entries, bestOfBreed)
    : null;
  const bestOfOpposite = breedCandidates.find(
    (result) =>
      result.dogId !== bestOfBreed?.dogId &&
      entrySexForResult(args.entries, result) !== bestOfBreedSex
  );
  const breedWinnerDogIds = new Set(
    [bestOfBreed?.dogId, bestOfOpposite?.dogId].filter(
      (dogId): dogId is string => Boolean(dogId)
    )
  );
  const specialEntriesById = new Map(
    args.entries
      .filter((entry) => entry.isChampion)
      .map((entry) => [entry.showEntryId, entry])
  );
  const remainingSpecials = args.breedResults.filter(
    (result) =>
      !breedWinnerDogIds.has(result.dogId) &&
      specialEntriesById.has(result.showEntryId)
  );
  const selectDog = remainingSpecials.find((result) => {
    const entry = specialEntriesById.get(result.showEntryId);
    return entry?.dog.sex === "M";
  });
  const selectBitch = remainingSpecials.find((result) => {
    const entry = specialEntriesById.get(result.showEntryId);
    return entry?.dog.sex === "F";
  });
  const awards: JudgedShowAward[] = [];
  const maleWinnerPoints = getChampionshipPointsForCompetition(
    args.maleClassResults.length
  );
  const femaleWinnerPoints = getChampionshipPointsForCompetition(
    args.femaleClassResults.length
  );
  const bestOfWinnersPoints = Math.max(maleWinnerPoints, femaleWinnerPoints);

  if (bestOfWinners && args.maleClassResults[0] && args.femaleClassResults[0]) {
    awards.push(
      makeAward({
        result: bestOfWinners,
        awardCode: "BOW",
        awardGroup: "BREED",
        sex: bestOfWinners.dogId === args.maleClassResults[0].dogId ? "M" : "F",
        rank: 1,
        pointsAwarded: bestOfWinnersPoints,
        dogsInCompetition: Math.max(
          args.maleClassResults.length,
          args.femaleClassResults.length
        ),
      })
    );
  }

  if (bestOfBreed) {
    awards.push(
      makeAward({
        result: bestOfBreed,
        awardCode: "BOB",
        awardGroup: "BREED",
        sex: null,
        rank: 1,
      })
    );
  }

  if (bestOfOpposite) {
    awards.push(
      makeAward({
        result: bestOfOpposite,
        awardCode: "BOS",
        awardGroup: "BREED",
        sex: bestOfOpposite.dogId === args.maleClassResults[0]?.dogId ? "M" : "F",
        rank: 2,
      })
    );
  }

  // TODO: Select Dog/Bitch will become GCH-point-eligible awards when GCH is implemented.
  if (selectDog) {
    awards.push(
      makeAward({
        result: selectDog,
        awardCode: "SELECT_DOG",
        awardGroup: "BREED",
        sex: "M",
        rank: 3,
      })
    );
  }

  // TODO: Select Dog/Bitch will become GCH-point-eligible awards when GCH is implemented.
  if (selectBitch) {
    awards.push(
      makeAward({
        result: selectBitch,
        awardCode: "SELECT_BITCH",
        awardGroup: "BREED",
        sex: "F",
        rank: 4,
      })
    );
  }

  return awards;
}

export function judgeBreedBlock(args: {
  entries: JudgingEntry[];
  judge: Judge;
  showEpoch?: number;
  random01?: () => number;
}): JudgedBreedBlock {
  const results = judgeBreedEntries(args);
  const classEntries = args.entries.filter((entry) => !entry.isChampion);
  const specialEntries = args.entries.filter((entry) => entry.isChampion);
  const maleClassResults = results.filter((result) => {
    const entry = classEntries.find((candidate) => candidate.showEntryId === result.showEntryId);
    return entry?.dog.sex === "M";
  });
  const femaleClassResults = results.filter((result) => {
    const entry = classEntries.find((candidate) => candidate.showEntryId === result.showEntryId);
    return entry?.dog.sex === "F";
  });
  const breedResults = results.filter((result) => {
    const entry = args.entries.find((candidate) => candidate.showEntryId === result.showEntryId);
    return (
      Boolean(entry?.isChampion) ||
      result.showEntryId === maleClassResults[0]?.showEntryId ||
      result.showEntryId === femaleClassResults[0]?.showEntryId
    );
  });

  return {
    results,
    awards: [
      ...buildSexClassAwards({ results: maleClassResults, sex: "M" }),
      ...buildSexClassAwards({ results: femaleClassResults, sex: "F" }),
      ...buildWinnersAwards({ results: maleClassResults, sex: "M" }),
      ...buildWinnersAwards({ results: femaleClassResults, sex: "F" }),
      ...buildBreedAwards({
        entries: args.entries,
        maleClassResults,
        femaleClassResults,
        breedResults,
      }),
    ],
  };
}

function entrySexForResult(
  entries: JudgingEntry[],
  result: JudgedEntryResult
): "M" | "F" | null {
  return (
    entries.find((entry) => entry.showEntryId === result.showEntryId)?.dog.sex ??
    null
  );
}

export function judgeGroup(args: {
  entries: JudgingEntry[];
  judge: Judge;
  showEpoch?: number;
  random01?: () => number;
}): JudgedShowAward[] {
  const results = judgeBreedEntries(args);

  return results.slice(0, 4).map((result, index) =>
    makeAward({
      result,
      awardCode: `G${index + 1}` as ShowAwardCode,
      awardGroup: "GROUP",
      sex: entrySexForResult(args.entries, result),
      rank: index + 1,
      dogsInCompetition: args.entries.length,
    })
  );
}

export function judgeBestInShow(args: {
  entries: JudgingEntry[];
  judge: Judge;
  showEpoch?: number;
  random01?: () => number;
}): JudgedShowAward[] {
  const results = judgeBreedEntries(args);
  const bestInShow = results[0];
  const reserveBestInShow = results[1];
  const awards: JudgedShowAward[] = [];

  if (bestInShow) {
    awards.push(
      makeAward({
        result: bestInShow,
        awardCode: "BIS",
        awardGroup: "BEST_IN_SHOW",
        sex: entrySexForResult(args.entries, bestInShow),
        rank: 1,
        dogsInCompetition: args.entries.length,
      })
    );
  }

  if (reserveBestInShow) {
    awards.push(
      makeAward({
        result: reserveBestInShow,
        awardCode: "RBIS",
        awardGroup: "BEST_IN_SHOW",
        sex: entrySexForResult(args.entries, reserveBestInShow),
        rank: 2,
        dogsInCompetition: args.entries.length,
      })
    );
  }

  return awards;
}

export function rankDogsByJudgeWeights(args: {
  dogs: Dog[];
  judge: Judge;
  showEpoch?: number;
  random01?: () => number;
}): JudgedDogBreakdown[] {
  return judgeBreedEntries({
    entries: args.dogs.map((dog) => ({ dog })),
    judge: args.judge,
    showEpoch: args.showEpoch,
    random01: args.random01,
  }).map(({ showEntryId, finalRank, placementCode, ...result }) => result);
}
