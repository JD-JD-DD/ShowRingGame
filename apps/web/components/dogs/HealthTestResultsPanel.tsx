import {
  getPhenotypeHealthResultLabel,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  type PhenotypeHealthTestCode,
} from "@showring/rules";

export type PublicHealthTestResult = {
  testTypeCode: string;
  resultCode: string;
};

type HealthTestResultsPanelProps = {
  tests: readonly PublicHealthTestResult[];
};

function isPhenotypeHealthTestCode(
  value: string
): value is PhenotypeHealthTestCode {
  return PHENOTYPE_HEALTH_TEST_CODES.includes(value as PhenotypeHealthTestCode);
}

/**
 * Produces the public, latest-per-test read model used wherever a dog card
 * displays completed phenotype health testing.
 */
export function publicHealthTestResultRows(
  tests: readonly PublicHealthTestResult[]
) {
  const seenTestCodes = new Set<string>();

  return tests.flatMap((test) => {
    if (
      seenTestCodes.has(test.testTypeCode) ||
      !isPhenotypeHealthTestCode(test.testTypeCode)
    ) {
      return [];
    }

    seenTestCodes.add(test.testTypeCode);
    return [
      {
        testTypeCode: test.testTypeCode,
        label: PHENOTYPE_HEALTH_TESTS[test.testTypeCode].label,
        result: getPhenotypeHealthResultLabel(
          test.testTypeCode,
          test.resultCode
        ),
      },
    ];
  });
}

export default function HealthTestResultsPanel({
  tests,
}: HealthTestResultsPanelProps) {
  const results = publicHealthTestResultRows(tests);

  return (
    <div className="theme-card rounded-2xl px-4 py-3">
      <div className="theme-label text-xs uppercase tracking-wide">
        Health Tests
      </div>
      {results.length === 0 ? (
        <div className="theme-heading mt-1 font-medium">Untested</div>
      ) : (
        <dl className="theme-copy mt-1 grid gap-1 text-sm">
          {results.map((test) => (
            <div key={test.testTypeCode}>
              <dt className="inline font-medium">{test.label}: </dt>
              <dd className="inline">{test.result}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
