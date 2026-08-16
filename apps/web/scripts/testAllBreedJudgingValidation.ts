import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  FIXED_CONFORMATION_BUDGET,
  GENETIC_JUDGING_CATEGORIES,
  combineBreedAndJudgeConformationWeights,
  createJudge,
  deriveBreedConformationCategoryWeights,
  deriveRawBreedConformationCategoryWeights,
  judgeBestInShow,
  judgeBreedBlock,
  judgeGroup,
  scoreDogByJudgeWeights,
  type BreedConformationCategoryWeights,
  type Dog,
  type Judge,
  type JudgeStyle,
  type NormalizedBreedTraitWeights,
} from "@showring/rules";

import { createBreedJudgingResultAudit, validateBreedWeightedResultAudit } from "../server/services/judgingAudit.service";
import { getBreedConformationProfileForJudging, InvalidActiveBreedJudgingProfileError } from "../server/services/breedConformationWeightsForJudging.service";
import { parseBreedJudgingProfilesCsv, parseCanonicalBreedsCsv, toNormalizedBreedJudgingTraitWeights, validateBreedJudgingProfileCoverage } from "../server/services/breedJudgingProfile.service";
import { AmbiguousActiveBreedJudgingProfileError, MissingBreedJudgingProfileError } from "../server/services/breedJudgingProfilePersistence.service";

const CATEGORIES = GENETIC_JUDGING_CATEGORIES;
const STYLES: JudgeStyle[] = ["BALANCED", "TYPE_FOCUSED", "STRUCTURE_FOCUSED", "MOVEMENT_FOCUSED", "PRESENTATION_FOCUSED", "TEMPERAMENT_FOCUSED"];
const EPSILON = 1e-9;
const data = (file: string) => readFileSync(resolve(process.cwd(), `prisma/data/${file}`), "utf8");
const sum = (weights: Record<string, number>) => Object.values(weights).reduce((total, value) => total + value, 0);
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const vectorDistance = (left: Record<string, number>, right: Record<string, number>) => CATEGORIES.reduce((total, category) => total + Math.abs(left[category] - right[category]), 0);
const fail = (category: string, detail: string): never => { throw new Error(`[${category}] ${detail}`); };
const close = (actual: number, expected: number, label: string) => { if (Math.abs(actual - expected) > EPSILON) fail("JUDGE_06_INVARIANT", `${label}; got ${actual}, expected ${expected}`); };

function fixtureClient(rows: unknown[]) {
  return { breedJudgingProfile: { findMany: async () => rows } };
}

function judgeFor(style: JudgeStyle): Judge {
  return createJudge({ judgeId: style, name: style, style, random01: () => .5 });
}

function conformationJudgeWeights(judge: Judge): BreedConformationCategoryWeights {
  return {
    TYPE_EXPRESSION: judge.categoryWeights.TYPE_EXPRESSION,
    STRUCTURE_BALANCE: judge.categoryWeights.STRUCTURE_BALANCE,
    MOVEMENT: judge.categoryWeights.MOVEMENT,
    COAT_PRESENTATION: judge.categoryWeights.COAT_PRESENTATION,
    TEMPERAMENT_RING_BEHAVIOR: judge.categoryWeights.TEMPERAMENT_RING_BEHAVIOR,
  };
}

function dog(id: string, traits: number | Partial<NormalizedBreedTraitWeights>): Dog {
  const base = typeof traits === "number" ? Object.fromEntries(["head", "forequarters", "hindquarters", "gait", "coat", "size", "temperament", "show_shine", "feet", "topline"].map((trait) => [trait, traits])) : { head: 8, forequarters: 8, hindquarters: 8, gait: 8, coat: 8, size: 8, temperament: 8, show_shine: 8, feet: 8, topline: 8, ...traits };
  return { dogId: id, regNumber: id, breedCode2: "ZZ", birthEpoch: 0, sex: "M", status: "ALIVE", litterId: null, litterOrder: null, sireId: null, damId: null, traits: base as NormalizedBreedTraitWeights };
}

function sequenceRandom(values: number[]) {
  let index = 0;
  return () => values[index++ % values.length];
}

function statistics<T>(items: T[], value: (item: T) => number, label: (item: T) => string) {
  const ordered = [...items].sort((left, right) => value(left) - value(right));
  const values = ordered.map(value);
  return { min: value(ordered[0]), minAt: label(ordered[0]), max: value(ordered.at(-1)!), maxAt: label(ordered.at(-1)!), mean: sum(Object.fromEntries(values.map((entry, index) => [index, entry]))) / values.length, median: median(values) };
}

async function main() {
  const canonicalBreeds = parseCanonicalBreedsCsv(data("breeds.csv"));
  const profiles = validateBreedJudgingProfileCoverage({ canonicalBreeds, profiles: parseBreedJudgingProfilesCsv(data("JUDGE-01_Breed_Judging_Profile.csv")) });
  const judges = STYLES.map(judgeFor);
  const profileByCode = new Map(profiles.map((profile) => [profile.breedCode2, profile]));
  if (profileByCode.size !== canonicalBreeds.length || profiles.length !== canonicalBreeds.length) fail("PROFILE_COMPLETENESS", `canonical=${canonicalBreeds.length}, profiles=${profiles.length}, unique=${profileByCode.size}`);

  const derived = profiles.map((profile) => {
    const normalized = toNormalizedBreedJudgingTraitWeights(profile);
    const raw = deriveRawBreedConformationCategoryWeights(normalized);
    const weights = deriveBreedConformationCategoryWeights(normalized);
    close(sum(raw), 1, `${profile.breedCode2} raw overlap conservation`);
    close(sum(weights), 1, `${profile.breedCode2} derived category total`);
    if ("CONDITIONING_HANDLING" in weights) fail("JUDGE_03_OVERLAP_MATH", `${profile.breedCode2} leaked Conditioning into breed weights`);
    CATEGORIES.forEach((category) => { if (!Number.isFinite(weights[category]) || weights[category] < 0) fail("JUDGE_03_OVERLAP_MATH", `${profile.breedCode2} ${category}=${weights[category]}`); });
    return { profile, normalized, raw, weights };
  });

  const matrix = derived.flatMap((entry) => judges.map((judge) => {
    const effective = combineBreedAndJudgeConformationWeights({ breedWeights: entry.weights, judgeWeights: conformationJudgeWeights(judge) });
    close(sum(effective), FIXED_CONFORMATION_BUDGET, `${entry.profile.breedCode2}/${judge.style} effective budget`);
    return { ...entry, judge, effective };
  }));
  const categoryDistribution = Object.fromEntries(CATEGORIES.map((category) => [category, statistics(derived, (entry) => entry.weights[category], (entry) => entry.profile.breed)]));
  const effectiveDistribution = Object.fromEntries(CATEGORIES.map((category) => [category, statistics(matrix, (entry) => entry.effective[category], (entry) => `${entry.profile.breed}/${entry.judge.style}`)]));
  const known = ["South Russian Ovcharka", "Halden Hound", "Kuvasz", "Swedish Vallhund", "Tosa Inu"];
  known.forEach((breed) => assert.ok(derived.some((entry) => entry.profile.breed === breed), `known reviewed profile ${breed} is covered`));

  const judgeDistances = derived.flatMap((entry) => judges.slice(1).map((judge) => vectorDistance(
    matrix.find((candidate) => candidate.profile.breedCode2 === entry.profile.breedCode2 && candidate.judge.style === "BALANCED")!.effective,
    matrix.find((candidate) => candidate.profile.breedCode2 === entry.profile.breedCode2 && candidate.judge.style === judge.style)!.effective
  )));
  if (judgeDistances.some((distance) => distance <= EPSILON)) fail("JUDGE_04_INTEGRATION", "a breed erased an existing judge-style difference");
  const breedVectorCounts = judges.map((judge) => new Set(matrix.filter((entry) => entry.judge.style === judge.style).map((entry) => CATEGORIES.map((category) => entry.effective[category].toFixed(12)).join(","))).size);
  if (breedVectorCounts.some((count) => count < 2)) fail("JUDGE_04_INTEGRATION", "a tested judge flattened all breed profiles");

  const balanced = judgeFor("BALANCED");
  const presentation = judgeFor("PRESENTATION_FOCUSED");
  if (presentation.categoryWeights.CONDITIONING_HANDLING <= balanced.categoryWeights.CONDITIONING_HANDLING) fail("JUDGE_04_INTEGRATION", "presentation-focused judge lost existing conditioning preference");
  const conditioningDog = dog("conditioning", 10);
  const conditioningScores = derived.slice(0, 2).map((entry) => judgeBreedBlock({ entries: [{ dog: conditioningDog }], judge: balanced, conformationCategoryWeights: combineBreedAndJudgeConformationWeights({ breedWeights: entry.weights, judgeWeights: conformationJudgeWeights(balanced) }), random01: () => .5 }).results[0].weightedCategoryScores.CONDITIONING_HANDLING);
  close(conditioningScores[0], conditioningScores[1], "conditioning contribution across breed substitutions");

  const ideal = (value: number) => scoreDogByJudgeWeights({ dog: dog(`ideal-${value}`, value), judge: balanced, conformationCategoryWeights: matrix[0].effective, random01: () => .5 }).weightedCategoryScores.TYPE_EXPRESSION;
  [[8, 12], [7, 13], [6, 14]].forEach(([left, right]) => close(ideal(left), ideal(right), `ideal symmetry ${left}/${right}`));
  if (!(ideal(10) > ideal(9) && ideal(10) > ideal(11) && ideal(10) > ideal(14))) fail("EXISTING_IDEAL_SCORING", "distance-from-10 semantics failed");

  const movementBreed = derived.reduce((best, entry) => entry.weights.MOVEMENT > best.weights.MOVEMENT ? entry : best);
  const structureBreed = derived.reduce((best, entry) => entry.weights.STRUCTURE_BALANCE > best.weights.STRUCTURE_BALANCE ? entry : best);
  const leastMovementBreed = derived.reduce((best, entry) => entry.weights.MOVEMENT < best.weights.MOVEMENT ? entry : best);
  const movementContribution = (entry: typeof movementBreed) => scoreDogByJudgeWeights({ dog: dog("movement-contribution", { gait: 10 }), judge: balanced, conformationCategoryWeights: combineBreedAndJudgeConformationWeights({ breedWeights: entry.weights, judgeWeights: conformationJudgeWeights(balanced) }), random01: () => .5 }).weightedCategoryScores.MOVEMENT;
  if (movementContribution(movementBreed) <= movementContribution(leastMovementBreed)) fail("JUDGE_04_INTEGRATION", "higher breed Movement emphasis did not increase identical Movement contribution");
  const archetypes: Array<[string, Partial<NormalizedBreedTraitWeights>]> = [
    ["BALANCED_GOOD", { head: 9.5, forequarters: 9.5, hindquarters: 9.5, gait: 9.5, coat: 9.5, size: 9.5, temperament: 9.5, show_shine: 9.5, feet: 9.5, topline: 9.5 }],
    ["MOVEMENT_STRENGTH", { gait: 10, forequarters: 9.5, hindquarters: 9.5 }], ["STRUCTURE_STRENGTH", { forequarters: 10, hindquarters: 10, feet: 10, topline: 10 }],
    ["TYPE_STRENGTH", { head: 10, size: 10, show_shine: 10 }], ["COAT_STRENGTH", { coat: 10, show_shine: 10 }], ["TEMPERAMENT_STRENGTH", { temperament: 10, show_shine: 10 }],
    ["UNEVEN_DOG", { gait: 10, head: 5, forequarters: 5, hindquarters: 5, coat: 5, size: 5, temperament: 5, show_shine: 5, feet: 5, topline: 5 }],
  ];
  const syntheticScores: number[] = []; const winners = new Map<string, number>();
  for (const entry of derived) for (const judge of judges) {
    const effective = combineBreedAndJudgeConformationWeights({ breedWeights: entry.weights, judgeWeights: conformationJudgeWeights(judge) });
    const results = judgeBreedBlock({ entries: archetypes.map(([name, traits]) => ({ showEntryId: `${entry.profile.breedCode2}-${judge.style}-${name}`, dog: dog(name, traits) })), judge, conformationCategoryWeights: effective, random01: () => .5 }).results;
    results.forEach((result) => syntheticScores.push(result.finalScore));
    const winner = archetypes.find(([name]) => results[0].showEntryId?.endsWith(name))?.[0] ?? "UNKNOWN";
    winners.set(winner, (winners.get(winner) ?? 0) + 1);
  }
  const perfectSubtotals = matrix.map(({ effective }) => CATEGORIES.reduce((total, category) => total + 7 * effective[category], 0));
  perfectSubtotals.forEach((subtotal) => close(subtotal, 35, "equal-quality fixed conformation subtotal"));

  const deterministicEntries = [{ showEntryId: "strong", dog: dog("strong", 10) }, { showEntryId: "weak", dog: dog("weak", 6) }];
  const effective = matrix[0].effective;
  const stableA = judgeBreedBlock({ entries: deterministicEntries, judge: balanced, conformationCategoryWeights: effective, random01: () => .5 });
  const stableB = judgeBreedBlock({ entries: deterministicEntries, judge: balanced, conformationCategoryWeights: effective, random01: () => .5 });
  assert.deepEqual(stableA.results.map((result) => [result.showEntryId, result.finalScore, result.finalRank]), stableB.results.map((result) => [result.showEntryId, result.finalScore, result.finalRank]), "same realized stochastic inputs reproduce ranking");
  let strongWins = 0; let closeChanges = 0;
  for (let trial = 0; trial < 50; trial += 1) {
    const flip = trial % 2 === 0;
    const strong = judgeBreedBlock({ entries: deterministicEntries, judge: balanced, conformationCategoryWeights: effective, random01: sequenceRandom(flip ? [0, 0, .5, 1, 1, .5] : [1, 1, .5, 0, 0, .5]) }).results;
    if (strong[0].showEntryId === "strong") strongWins += 1;
    const closeResults = judgeBreedBlock({ entries: [{ showEntryId: "a", dog: dog("a", 9.9) }, { showEntryId: "b", dog: dog("b", 9.8) }], judge: balanced, conformationCategoryWeights: effective, random01: sequenceRandom(flip ? [0, 0, .5, 1, 1, .5] : [1, 1, .5, 0, 0, .5]) }).results;
    if (closeResults[0].showEntryId === "b") closeChanges += 1;
  }
  if (strongWins !== 50) fail("EXISTING_RANDOM_VARIANCE", `strong-quality dog won ${strongWins}/50 under existing ±5%/±3% variance`);
  if (closeChanges === 0) fail("EXISTING_RANDOM_VARIANCE", "near-equal lineup never moved under existing variance");

  const auditResult = judgeBreedBlock({ entries: [{ showEntryId: "audit", dog: dog("audit", 10) }], judge: balanced, conformationCategoryWeights: effective, random01: () => .5 }).results[0];
  const audit = createBreedJudgingResultAudit({ effectiveConformationWeights: effective, judge: balanced, result: auditResult });
  validateBreedWeightedResultAudit({ scoringVersion: "breed-weighted-v1", breedJudgingProfileId: `fixture-${matrix[0].profile.breedCode2}`, breedJudgingRulesVersion: matrix[0].profile.rulesVersion, audit });

  await assert.rejects(() => getBreedConformationProfileForJudging({ client: fixtureClient([]) as never, breedCode2: "missing" }), MissingBreedJudgingProfileError, "missing profile fails before scoring");
  await assert.rejects(() => getBreedConformationProfileForJudging({ client: fixtureClient([{ ...profiles[0], id: "one" }, { ...profiles[0], id: "two", rulesVersion: "v2" }]) as never, breedCode2: profiles[0].breedCode2 }), AmbiguousActiveBreedJudgingProfileError, "ambiguous profile fails before scoring");
  await assert.rejects(() => getBreedConformationProfileForJudging({ client: fixtureClient([{ ...profiles[0], id: "bad", headWeight: 99 }]) as never, breedCode2: profiles[0].breedCode2 }), InvalidActiveBreedJudgingProfileError, "invalid profile fails before scoring");
  assert.equal(judgeGroup({ entries: deterministicEntries, judge: balanced, random01: () => .5 })[0].awardGroup, "GROUP", "Group remains unweighted rules path");
  assert.equal(judgeBestInShow({ entries: deterministicEntries, judge: balanced, random01: () => .5 })[0].awardGroup, "BEST_IN_SHOW", "BIS remains unweighted rules path");

  const largestEffective = statistics(matrix, (entry) => Math.max(...CATEGORIES.map((category) => entry.effective[category])), (entry) => `${entry.profile.breed}/${entry.judge.style}`);
  const report = {
    canonicalBreedCount: canonicalBreeds.length, validProfileCount: profiles.length, activeProfileFixtureCount: profiles.filter((profile) => profile.isActive).length,
    coverage: { missing: 0, duplicate: 0, unknown: 0, invalidSourceTotal: 0 },
    matrixEvaluations: matrix.length, categoryDistribution, effectiveDistribution,
    dominance: { ...largestEffective, largestBudgetSharePercent: largestEffective.max / FIXED_CONFORMATION_BUDGET * 100 },
    judgeDifference: { min: Math.min(...judgeDistances), max: Math.max(...judgeDistances), erasedBreedCount: judgeDistances.filter((value) => value <= EPSILON).length },
    synthetic: { evaluations: syntheticScores.length, scoreMin: Math.min(...syntheticScores), scoreMax: Math.max(...syntheticScores), mean: syntheticScores.reduce((total, value) => total + value, 0) / syntheticScores.length, median: median(syntheticScores), winnerFrequency: Object.fromEntries(winners) },
    randomness: { closeLineupTrials: 50, closePlacementChanges: closeChanges, strongSeparationTrials: 50, strongDogWins: strongWins, dayVariance: .05, ringVariance: .03 },
    safeguards: { missing: "explicit failure/no score", ambiguous: "explicit failure/no score", invalid: "explicit failure/no score" },
  };
  console.log(JSON.stringify(report, null, 2));
  console.log("All-breed judging validation checks passed.");
}

void main();
