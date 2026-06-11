import {
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  type PhenotypeHealthTestCode,
} from "@showring/rules";

type PublicPhenotypeHealthTest = {
  testTypeCode: string;
  resultCode: string;
};

export type PhenotypeHealthSeverity = "green" | "yellow" | "red";
export type PhenotypeHealthBadgeStatus = PhenotypeHealthSeverity;

export function isGreenPhenotypeHealthResult(
  testTypeCode: string,
  resultCode: string
): boolean {
  return getPhenotypeHealthSeverity(testTypeCode, resultCode) === "green";
}

export function getPhenotypeHealthSeverity(
  testTypeCode: string,
  resultCode: string
): PhenotypeHealthSeverity {
  const definition =
    PHENOTYPE_HEALTH_TESTS[testTypeCode as PhenotypeHealthTestCode];

  return definition?.resultSeverityByCode[resultCode] ?? "red";
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

export function getPhenotypeHealthBadgeStatus(
  testsNewestFirst: PublicPhenotypeHealthTest[]
): PhenotypeHealthBadgeStatus | null {
  const latestResults = PHENOTYPE_HEALTH_TEST_CODES.flatMap((testTypeCode) => {
    const latestResult = testsNewestFirst.find(
      (test) => test.testTypeCode === testTypeCode
    );

    return latestResult ? [{ testTypeCode, resultCode: latestResult.resultCode }] : [];
  });

  if (
    latestResults.some(
      (test) => getPhenotypeHealthSeverity(test.testTypeCode, test.resultCode) === "red"
    )
  ) {
    return "red";
  }

  if (
    latestResults.some(
      (test) => getPhenotypeHealthSeverity(test.testTypeCode, test.resultCode) === "yellow"
    )
  ) {
    return "yellow";
  }

  return latestResults.length > 0 ? "green" : null;
}

export function hasFullPhenotypeHealthClearance(
  testsNewestFirst: PublicPhenotypeHealthTest[]
): boolean {
  return hasAllGreenPhenotypeHealthTests(testsNewestFirst);
}
