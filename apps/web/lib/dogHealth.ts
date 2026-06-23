import {
  getRequiredHealthTestsForBreed,
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

export function hasCompletedRequiredPhenotypeHealthTests(
  testsNewestFirst: PublicPhenotypeHealthTest[],
  breedCode?: string | null
): boolean {
  const requiredTestCodes = getRequiredHealthTestsForBreed(breedCode);

  return requiredTestCodes.every((testTypeCode) =>
    testsNewestFirst.some((test) => test.testTypeCode === testTypeCode)
  );
}

export function hasAllGreenRequiredPhenotypeHealthTests(
  testsNewestFirst: PublicPhenotypeHealthTest[],
  breedCode?: string | null
): boolean {
  const requiredTestCodes = getRequiredHealthTestsForBreed(breedCode);

  return requiredTestCodes.every((testTypeCode) => {
    const latestResult = testsNewestFirst.find(
      (test) => test.testTypeCode === testTypeCode
    );

    return (
      latestResult != null &&
      isGreenPhenotypeHealthResult(testTypeCode, latestResult.resultCode)
    );
  });
}

export function hasAllGreenPhenotypeHealthTests(
  testsNewestFirst: PublicPhenotypeHealthTest[],
  breedCode?: string | null
): boolean {
  return hasAllGreenRequiredPhenotypeHealthTests(testsNewestFirst, breedCode);
}

export function getRequiredPhenotypeHealthBadgeStatus(
  testsNewestFirst: PublicPhenotypeHealthTest[],
  breedCode?: string | null
): PhenotypeHealthBadgeStatus | null {
  const requiredTestCodes = getRequiredHealthTestsForBreed(breedCode);
  const latestResults = requiredTestCodes.flatMap((testTypeCode) => {
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

export function getPhenotypeHealthBadgeStatus(
  testsNewestFirst: PublicPhenotypeHealthTest[],
  breedCode?: string | null
): PhenotypeHealthBadgeStatus | null {
  return getRequiredPhenotypeHealthBadgeStatus(testsNewestFirst, breedCode);
}

export function hasFullPhenotypeHealthClearance(
  testsNewestFirst: PublicPhenotypeHealthTest[],
  breedCode?: string | null
): boolean {
  return hasAllGreenRequiredPhenotypeHealthTests(testsNewestFirst, breedCode);
}
