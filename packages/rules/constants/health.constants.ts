export const PHENOTYPE_HEALTH_TEST_CODES = [
  "HIP_DYSPLASIA",
  "CARDIAC",
  "CAER_EYE",
  "THYROID",
] as const;

export const BRUCELLOSIS_DISEASE_CODE = "BRUCELLOSIS";
export const BRUCELLOSIS_TEST_FEE = 75;
export const BRUCELLOSIS_TEST_VALID_HOURS = 30;
export const BRUCELLOSIS_FOUNDATION_INFECTION_RATE = 0.004;

export type PhenotypeHealthTestCode =
  (typeof PHENOTYPE_HEALTH_TEST_CODES)[number];

export type PhenotypeHealthSeverity = "green" | "yellow" | "red";

type PhenotypeHealthTestDefinition = {
  label: string;
  fee: number;
  minimumAgeHours: number;
  minimumAgeLabel: string;
  resultSeverityByCode: Record<string, PhenotypeHealthSeverity>;
};

export const PHENOTYPE_HEALTH_TESTS: Record<
  PhenotypeHealthTestCode,
  PhenotypeHealthTestDefinition
> = {
  HIP_DYSPLASIA: {
    label: "Hip Dysplasia",
    fee: 350,
    minimumAgeHours: 730,
    minimumAgeLabel: "Available at 24 months",
    resultSeverityByCode: {
      EXCELLENT: "green",
      GOOD: "green",
      FAIR: "green",
      BORDERLINE: "yellow",
      MILD: "red",
      MODERATE: "red",
      SEVERE: "red",
    },
  },
  CARDIAC: {
    label: "Cardiac",
    fee: 350,
    minimumAgeHours: 365,
    minimumAgeLabel: "Available at 12 months",
    resultSeverityByCode: {
      NORMAL: "green",
      EQUIVOCAL: "yellow",
      ABNORMAL: "red",
    },
  },
  CAER_EYE: {
    label: "CAER Eye",
    fee: 75,
    minimumAgeHours: 56,
    minimumAgeLabel: "Available at 8 weeks",
    resultSeverityByCode: {
      NORMAL: "green",
      BREEDER_OPTION: "yellow",
      NOT_CLEARED: "red",
    },
  },
  THYROID: {
    label: "Thyroid",
    fee: 175,
    minimumAgeHours: 365,
    minimumAgeLabel: "Available at 12 months",
    resultSeverityByCode: {
      NORMAL: "green",
      EQUIVOCAL: "yellow",
      AUTOIMMUNE_THYROIDITIS: "red",
      REDUCED_THYROID_FUNCTION: "red",
    },
  },
};
