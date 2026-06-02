export const PHENOTYPE_HEALTH_TEST_CODES = [
  "HIP_DYSPLASIA",
  "CARDIAC",
  "CAER_EYE",
  "THYROID",
] as const;

export type PhenotypeHealthTestCode =
  (typeof PHENOTYPE_HEALTH_TEST_CODES)[number];

export const PHENOTYPE_HEALTH_TESTS: Record<
  PhenotypeHealthTestCode,
  { label: string; fee: number }
> = {
  HIP_DYSPLASIA: {
    label: "Hip Dysplasia",
    fee: 200,
  },
  CARDIAC: {
    label: "Cardiac",
    fee: 150,
  },
  CAER_EYE: {
    label: "CAER Eye",
    fee: 100,
  },
  THYROID: {
    label: "Thyroid",
    fee: 150,
  },
};
