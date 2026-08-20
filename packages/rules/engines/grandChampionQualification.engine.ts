export type GrandChampionQualificationCredit = Readonly<{
  id: string;
  showDayId: string;
  pointsAwarded: number;
  isMajor: boolean;
  judgeId: string | null;
  countsAsChampionDefeat: boolean;
  qualifyingChampionOpponentCount: number | null;
}>;

export type GrandChampionQualificationResult = Readonly<{
  totalPoints: number;
  majorShowCount: number;
  qualifyingMajorPoints: number;
  majorJudgeCount: number;
  pointAwardingJudgeCount: number;
  championDefeatShowCount: number;
  majorJudgeIds: readonly string[];
  pointAwardingJudgeIds: readonly string[];
  qualifyingMajorShowIds: readonly string[];
  championDefeatShowIds: readonly string[];
  requirements: Readonly<{
    pointsMet: boolean;
    majorsMet: boolean;
    majorJudgesMet: boolean;
    additionalJudgeMet: boolean;
    championDefeatsMet: boolean;
  }>;
  qualifiesForInitialGch: boolean;
  highestPointTier: string | null;
}>;

const MILESTONES = [
  [4000, "GCHP5"], [3200, "GCHP4"], [2400, "GCHP3"], [1600, "GCHP2"],
  [800, "GCHP"], [400, "GCHG"], [200, "GCHS"], [100, "GCHB"], [25, "GCH"],
] as const;

function highestTier(points: number): string | null {
  return MILESTONES.find(([required]) => points >= required)?.[1] ?? null;
}

/** Evaluates durable GCH credit facts without recalculating their history. */
export function evaluateGrandChampionQualification(args: {
  credits: readonly GrandChampionQualificationCredit[];
  alreadyGrandChampion: boolean;
}): GrandChampionQualificationResult {
  const canonicalByShowDay = new Map<string, GrandChampionQualificationCredit>();
  for (const credit of args.credits) {
    if (credit.pointsAwarded <= 0) continue;
    const existing = canonicalByShowDay.get(credit.showDayId);
    if (!existing || credit.pointsAwarded > existing.pointsAwarded ||
      (credit.pointsAwarded === existing.pointsAwarded && credit.id < existing.id)) {
      canonicalByShowDay.set(credit.showDayId, credit);
    }
  }

  const canonical = [...canonicalByShowDay.values()];
  const majorCredits = canonical.filter((credit) => credit.isMajor && credit.pointsAwarded >= 3);
  const defeatCredits = canonical.filter((credit) =>
    credit.qualifyingChampionOpponentCount !== null
      ? credit.qualifyingChampionOpponentCount >= 1
      : credit.countsAsChampionDefeat
  );
  const majorJudgeIds = [...new Set(majorCredits.flatMap((credit) => credit.judgeId ? [credit.judgeId] : []))].sort();
  const pointAwardingJudgeIds = [...new Set(canonical.flatMap((credit) => credit.judgeId ? [credit.judgeId] : []))].sort();
  const totalPoints = canonical.reduce((sum, credit) => sum + credit.pointsAwarded, 0);
  const requirements = {
    pointsMet: totalPoints >= 25,
    majorsMet: majorCredits.length >= 3,
    majorJudgesMet: majorJudgeIds.length >= 3,
    additionalJudgeMet: pointAwardingJudgeIds.length >= 4,
    championDefeatsMet: defeatCredits.length >= 3,
  };
  const qualifiesForInitialGch = args.alreadyGrandChampion || Object.values(requirements).every(Boolean);

  return {
    totalPoints,
    majorShowCount: majorCredits.length,
    qualifyingMajorPoints: majorCredits.reduce((sum, credit) => sum + credit.pointsAwarded, 0),
    majorJudgeCount: majorJudgeIds.length,
    pointAwardingJudgeCount: pointAwardingJudgeIds.length,
    championDefeatShowCount: defeatCredits.length,
    majorJudgeIds,
    pointAwardingJudgeIds,
    qualifyingMajorShowIds: majorCredits.map((credit) => credit.showDayId).sort(),
    championDefeatShowIds: defeatCredits.map((credit) => credit.showDayId).sort(),
    requirements,
    qualifiesForInitialGch,
    highestPointTier: qualifiesForInitialGch ? highestTier(Math.max(25, totalPoints)) : null,
  };
}
