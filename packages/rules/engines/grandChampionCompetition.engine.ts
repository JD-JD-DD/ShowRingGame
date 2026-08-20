export type GrandChampionCompetitionSex = "M" | "F";

export type GrandChampionQualifyingAwardCode =
  | "BOB"
  | "BOS"
  | "SELECT_DOG"
  | "SELECT_BITCH";

/**
 * A judging-time BOB-level participant. `countsForGchCompetition` is true
 * only when this participant adds a population unit beyond
 * `regularCompetitorCounts`; a regular-class dog advancing through Winners is
 * represented here for topology/provenance but is not double-counted.
 */
export type GrandChampionBobLevelCompetitor = Readonly<{
  dogId: string;
  sex: GrandChampionCompetitionSex;
  countsForGchCompetition: boolean;
  eligibleForGchRecipient: boolean;
  championDefeatEligible: boolean;
}>;

export type GrandChampionQualifyingAward = Readonly<{
  dogId: string;
  sex: GrandChampionCompetitionSex;
}>;

export type GrandChampionCompetitionSnapshot = Readonly<{
  breedCode2: string;
  regularCompetitorCounts: Readonly<Record<GrandChampionCompetitionSex, number>>;
  bobLevelCompetitors: readonly GrandChampionBobLevelCompetitor[];
  awards: Readonly<{
    BOB?: GrandChampionQualifyingAward;
    BOS?: GrandChampionQualifyingAward;
    SELECT_DOG?: GrandChampionQualifyingAward;
    SELECT_BITCH?: GrandChampionQualifyingAward;
  }>;
  sameShowDayWinnersDogIds: ReadonlySet<string>;
  sameShowDayWinnersBitchIds: ReadonlySet<string>;
}>;

export type GrandChampionCompetitionFailureCode =
  | "INVALID_REGULAR_COMPETITOR_COUNT"
  | "INVALID_DOG_ID"
  | "INVALID_SEX"
  | "DUPLICATE_BOB_LEVEL_COMPETITOR"
  | "QUALIFYING_AWARD_RECIPIENT_NOT_IN_BOB_POPULATION"
  | "INVALID_SELECT_AWARD_SEX"
  | "DUPLICATE_QUALIFYING_AWARD_RECIPIENT"
  | "INVALID_BOB_BOS_TOPOLOGY"
  | "INVALID_SELECT_TOPOLOGY"
  | "NEGATIVE_SELECT_COMPETITION_COUNT";

export class GrandChampionCompetitionError extends Error {
  constructor(
    public readonly code: GrandChampionCompetitionFailureCode,
    message: string
  ) {
    super(message);
    this.name = "GrandChampionCompetitionError";
  }
}

export type GrandChampionChampionDefeatFacts = Readonly<{
  qualifyingChampionOpponentCount: number;
  countsAsPotentialChampionDefeat: boolean;
}>;

export type GrandChampionAwardCompetitionResult = Readonly<{
  awardCode: GrandChampionQualifyingAwardCode;
  recipientDogId: string;
  recipientSex: GrandChampionCompetitionSex;
  recipientEligible: boolean;
  competitionCount: number;
  bobSameSexComparisonCount?: number;
  championDefeatFacts: GrandChampionChampionDefeatFacts;
}>;

function invalid(code: GrandChampionCompetitionFailureCode, message: string): never {
  throw new GrandChampionCompetitionError(code, message);
}

function assertDogId(dogId: string, label: string): void {
  if (typeof dogId !== "string" || dogId.trim().length === 0) {
    invalid("INVALID_DOG_ID", `${label} must be a non-empty dog ID.`);
  }
}

function assertSex(sex: string, label: string): asserts sex is GrandChampionCompetitionSex {
  if (sex !== "M" && sex !== "F") invalid("INVALID_SEX", `${label} must be M or F.`);
}

function validateSnapshot(snapshot: GrandChampionCompetitionSnapshot): Map<string, GrandChampionBobLevelCompetitor> {
  if (typeof snapshot.breedCode2 !== "string" || snapshot.breedCode2.trim().length === 0) invalid("INVALID_DOG_ID", "Snapshot breedCode2 must be non-empty.");
  for (const sex of ["M", "F"] as const) {
    const count = snapshot.regularCompetitorCounts[sex];
    if (!Number.isFinite(count) || !Number.isInteger(count) || count < 0) invalid("INVALID_REGULAR_COMPETITOR_COUNT", `Regular ${sex} competitor count must be a finite non-negative integer.`);
  }
  const competitorsByDogId = new Map<string, GrandChampionBobLevelCompetitor>();
  for (const competitor of snapshot.bobLevelCompetitors) {
    assertDogId(competitor.dogId, "BOB-level competitor dogId");
    assertSex(competitor.sex, "BOB-level competitor sex");
    if (competitorsByDogId.has(competitor.dogId)) invalid("DUPLICATE_BOB_LEVEL_COMPETITOR", `Duplicate BOB-level competitor: ${competitor.dogId}.`);
    competitorsByDogId.set(competitor.dogId, competitor);
  }
  for (const [label, dogIds] of [["sameShowDayWinnersDogIds", snapshot.sameShowDayWinnersDogIds], ["sameShowDayWinnersBitchIds", snapshot.sameShowDayWinnersBitchIds]] as const) {
    for (const dogId of dogIds) assertDogId(dogId, label);
  }
  const awards = snapshot.awards;
  if (awards.BOS && !awards.BOB) invalid("INVALID_BOB_BOS_TOPOLOGY", "BOS requires a BOB award.");
  if (awards.BOB && awards.BOS && awards.BOB.dogId === awards.BOS.dogId) invalid("INVALID_BOB_BOS_TOPOLOGY", "BOB and BOS cannot belong to the same dog.");
  const awardEntries = (Object.entries(awards) as Array<[GrandChampionQualifyingAwardCode, GrandChampionQualifyingAward | undefined]>).filter((entry): entry is [GrandChampionQualifyingAwardCode, GrandChampionQualifyingAward] => Boolean(entry[1]));
  const awardDogIds = new Set<string>();
  for (const [awardCode, award] of awardEntries) {
    assertDogId(award.dogId, `${awardCode} recipient dogId`);
    assertSex(award.sex, `${awardCode} recipient sex`);
    if ((awardCode === "SELECT_DOG" && award.sex !== "M") || (awardCode === "SELECT_BITCH" && award.sex !== "F")) invalid("INVALID_SELECT_AWARD_SEX", `${awardCode} has an invalid recipient sex.`);
    const recipientCompetitor = competitorsByDogId.get(award.dogId);
    if (!recipientCompetitor) invalid("QUALIFYING_AWARD_RECIPIENT_NOT_IN_BOB_POPULATION", `${awardCode} recipient must be represented in the BOB-level population.`);
    if (recipientCompetitor.sex !== award.sex) invalid("INVALID_SEX", `${awardCode} recipient sex must match its BOB-level competitor sex.`);
    if (awardDogIds.has(award.dogId)) invalid("DUPLICATE_QUALIFYING_AWARD_RECIPIENT", `A dog cannot hold multiple qualifying GCH awards: ${award.dogId}.`);
    awardDogIds.add(award.dogId);
  }
  for (const awardCode of ["SELECT_DOG", "SELECT_BITCH"] as const) {
    const award = awards[awardCode];
    if (!award) continue;
    if (!awards.BOB) invalid("INVALID_SELECT_TOPOLOGY", `${awardCode} requires a BOB award.`);
    const higherSameSexAward = awards.BOB.sex === award.sex ? awards.BOB : awards.BOS?.sex === award.sex ? awards.BOS : undefined;
    if (!higherSameSexAward || higherSameSexAward.dogId === award.dogId) invalid("INVALID_SELECT_TOPOLOGY", `${awardCode} requires one distinct higher same-sex BOB/BOS award.`);
  }
  return competitorsByDogId;
}

function countBobLevelCompetitors(competitors: readonly GrandChampionBobLevelCompetitor[], sex?: GrandChampionCompetitionSex): number {
  return competitors.reduce((count, competitor) => count + (competitor.countsForGchCompetition && (sex === undefined || competitor.sex === sex) ? 1 : 0), 0);
}

function championDefeatFacts(competitors: readonly GrandChampionBobLevelCompetitor[], recipientDogId: string): GrandChampionChampionDefeatFacts {
  const qualifyingChampionOpponentCount = competitors.reduce(
    (count, competitor) => count + (competitor.championDefeatEligible && competitor.dogId !== recipientDogId ? 1 : 0),
    0
  );
  return { qualifyingChampionOpponentCount, countsAsPotentialChampionDefeat: qualifyingChampionOpponentCount > 0 };
}

function isRecipientEligible(recipient: GrandChampionQualifyingAward, competitor: GrandChampionBobLevelCompetitor, snapshot: GrandChampionCompetitionSnapshot): boolean {
  return competitor.eligibleForGchRecipient && !snapshot.sameShowDayWinnersDogIds.has(recipient.dogId) && !snapshot.sameShowDayWinnersBitchIds.has(recipient.dogId);
}

/** Calculates immutable judging-time GCH counts/evidence; never points, schedules, or persistence. */
export function calculateGrandChampionCompetitionCounts(snapshot: GrandChampionCompetitionSnapshot): readonly GrandChampionAwardCompetitionResult[] {
  const competitorsByDogId = validateSnapshot(snapshot);
  const bobLevelCounts = { M: countBobLevelCompetitors(snapshot.bobLevelCompetitors, "M"), F: countBobLevelCompetitors(snapshot.bobLevelCompetitors, "F") };
  const sameSexPopulationCount = (sex: GrandChampionCompetitionSex) => snapshot.regularCompetitorCounts[sex] + bobLevelCounts[sex];
  const fullBobPopulationCount = snapshot.regularCompetitorCounts.M + snapshot.regularCompetitorCounts.F + bobLevelCounts.M + bobLevelCounts.F;
  const results: GrandChampionAwardCompetitionResult[] = [];
  for (const awardCode of ["BOB", "BOS", "SELECT_DOG", "SELECT_BITCH"] as const) {
    const award = snapshot.awards[awardCode];
    if (!award) continue;
    const competitor = competitorsByDogId.get(award.dogId)!;
    const baseSameSexCount = sameSexPopulationCount(award.sex);
    let competitionCount = baseSameSexCount;
    let bobSameSexComparisonCount: number | undefined;
    if (awardCode === "BOB") {
      competitionCount = fullBobPopulationCount;
      bobSameSexComparisonCount = baseSameSexCount;
    } else if (awardCode === "SELECT_DOG" || awardCode === "SELECT_BITCH") {
      competitionCount -= 1;
      if (competitionCount < 0) invalid("NEGATIVE_SELECT_COMPETITION_COUNT", `${awardCode} produced a negative competition count.`);
    }
    results.push({ awardCode, recipientDogId: award.dogId, recipientSex: award.sex, recipientEligible: isRecipientEligible(award, competitor, snapshot), competitionCount, ...(bobSameSexComparisonCount === undefined ? {} : { bobSameSexComparisonCount }), championDefeatFacts: championDefeatFacts(snapshot.bobLevelCompetitors, award.dogId) });
  }
  return results;
}
