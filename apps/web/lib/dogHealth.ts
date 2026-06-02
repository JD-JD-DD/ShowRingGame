import {
  PHENOTYPE_HEALTH_TEST_CODES,
  type PhenotypeHealthTestCode,
} from "@showring/rules";

type PublicPhenotypeHealthTest = {
  testTypeCode: string;
  resultCode: string;
};

export type PhenotypeHealthSeverity = "green" | "yellow" | "red";

export function isGreenPhenotypeHealthResult(
  testTypeCode: string,
  resultCode: string
): boolean {
  switch (testTypeCode as PhenotypeHealthTestCode) {
    case "HIP_DYSPLASIA":
      return (
        resultCode === "EXCELLENT" ||
        resultCode === "GOOD" ||
        resultCode === "FAIR"
      );
    case "CARDIAC":
    case "CAER_EYE":
    case "THYROID":
      return resultCode === "NORMAL";
    default:
      return false;
  }
}

export function getPhenotypeHealthSeverity(
  testTypeCode: string,
  resultCode: string
): PhenotypeHealthSeverity {
  if (isGreenPhenotypeHealthResult(testTypeCode, resultCode)) {
    return "green";
  }

  if (
    resultCode === "BORDERLINE" ||
    resultCode === "EQUIVOCAL" ||
    resultCode === "BREEDER_OPTION"
  ) {
    return "yellow";
  }

  return "red";
}

export function hasAllGreenPhenotypeHealthTests(
  testsNewestFirst: PublicPhenotypeHealthTest[]
): boolean {
  return PHENOTYPE_HEALTH_TEST_CODES.every((testTypeCode) => {
    const latestResult = testsNewestFirst.find(
      (test) => test.testTypeCode === testTypeCode
    );

    return (
      latestResult != null &&
      isGreenPhenotypeHealthResult(testTypeCode, latestResult.resultCode)
    );
  });
}
