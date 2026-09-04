export type RosterPhenotypeHealthTest = {
  resultCode: string | null;
  resultLabel: string | null;
  severity: "green" | "yellow" | "red" | null;
  state: "TESTED" | "UNTESTED" | "NOT_APPLICABLE";
  availabilityLabel: string | null;
};

export type RosterPhenotypeHealthTestCode =
  | "HIP_DYSPLASIA"
  | "ELBOW_DYSPLASIA"
  | "CARDIAC"
  | "THYROID"
  | "CAER_EYE";

export type RosterPhenotypeHealthByTestCode = Record<
  RosterPhenotypeHealthTestCode,
  RosterPhenotypeHealthTest
>;

export type RosterBrucellosisScreening = {
  currentStatusLabel: string;
  isCurrentNegative: boolean;
  isPositiveOrInfected: boolean;
  testedAtEpoch: number | null;
};

export type RosterHealthPresentation = {
  hips: RosterPhenotypeHealthTest;
  elbows: RosterPhenotypeHealthTest;
  cardiac: RosterPhenotypeHealthTest;
  thyroid: RosterPhenotypeHealthTest;
  caerEye: RosterPhenotypeHealthTest;
  brucellosis: RosterBrucellosisScreening;
};

export type RosterHealthColumnId = keyof RosterHealthPresentation;

const PHENOTYPE_TEST_CODE_BY_COLUMN: Record<
  Exclude<RosterHealthColumnId, "brucellosis">,
  RosterPhenotypeHealthTestCode
> = {
  hips: "HIP_DYSPLASIA",
  elbows: "ELBOW_DYSPLASIA",
  cardiac: "CARDIAC",
  thyroid: "THYROID",
  caerEye: "CAER_EYE",
};

const PHENOTYPE_RANKS: Record<
  Exclude<RosterHealthColumnId, "brucellosis">,
  readonly string[]
> = {
  hips: ["EXCELLENT", "GOOD", "FAIR", "BORDERLINE", "MILD", "MODERATE", "SEVERE"],
  elbows: ["NORMAL", "BORDERLINE", "GRADE_1", "GRADE_2", "GRADE_3"],
  cardiac: ["NORMAL", "EQUIVOCAL", "ABNORMAL"],
  thyroid: ["NORMAL", "EQUIVOCAL", "AUTOIMMUNE_THYROIDITIS", "REDUCED_THYROID_FUNCTION"],
  caerEye: ["NORMAL", "BREEDER_OPTION", "NOT_CLEARED"],
};

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function phenotypeRank(
  column: Exclude<RosterHealthColumnId, "brucellosis">,
  test: RosterPhenotypeHealthTest
): number {
  const ranks = PHENOTYPE_RANKS[column];
  if (test.state === "NOT_APPLICABLE") return ranks.length + 3;
  if (test.state === "UNTESTED") return ranks.length + 2;
  const resultIndex = test.resultCode ? ranks.indexOf(test.resultCode) : -1;
  return resultIndex >= 0 ? resultIndex : ranks.length + 1;
}

function brucellosisRank(screening: RosterBrucellosisScreening): number {
  if (screening.isCurrentNegative) return 0;
  if (screening.isPositiveOrInfected) return 3;
  return screening.testedAtEpoch === null ? 2 : 1;
}

export function getRosterPhenotypeHealthTest(
  phenotype: RosterPhenotypeHealthByTestCode,
  column: Exclude<RosterHealthColumnId, "brucellosis">
): RosterPhenotypeHealthTest {
  return phenotype[PHENOTYPE_TEST_CODE_BY_COLUMN[column]];
}

export function toRosterHealthPresentation(args: {
  phenotype: RosterPhenotypeHealthByTestCode;
  brucellosis: RosterBrucellosisScreening;
}): RosterHealthPresentation {
  return {
    hips: getRosterPhenotypeHealthTest(args.phenotype, "hips"),
    elbows: getRosterPhenotypeHealthTest(args.phenotype, "elbows"),
    cardiac: getRosterPhenotypeHealthTest(args.phenotype, "cardiac"),
    thyroid: getRosterPhenotypeHealthTest(args.phenotype, "thyroid"),
    caerEye: getRosterPhenotypeHealthTest(args.phenotype, "caerEye"),
    brucellosis: args.brucellosis,
  };
}

export function compareKennelRosterHealth(args: {
  a: { health: RosterHealthPresentation; ageHours: number; displayName: string };
  b: { health: RosterHealthPresentation; ageHours: number; displayName: string };
  column: RosterHealthColumnId;
  direction: "asc" | "desc";
}): number {
  const { a, b, column, direction } = args;
  const ascendingRank =
    column === "brucellosis"
      ? brucellosisRank(a.health.brucellosis) - brucellosisRank(b.health.brucellosis)
      : phenotypeRank(column, a.health[column]) - phenotypeRank(column, b.health[column]);
  const primary = direction === "asc" ? ascendingRank : -ascendingRank;
  if (primary !== 0) return primary;

  const ascendingAge = a.ageHours - b.ageHours;
  const secondary = direction === "asc" ? ascendingAge : -ascendingAge;
  return secondary !== 0 ? secondary : compareText(a.displayName, b.displayName);
}
