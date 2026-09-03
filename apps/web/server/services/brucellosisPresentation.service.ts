import { BRUCELLOSIS_DISEASE_CODE } from "@showring/rules";
import { epochToDate } from "@/lib/gameClock";
import { formatUtcDateTime } from "@/lib/gameTimeFormat";

const BRUCELLOSIS_SCREENING_HELPER_TEXT =
  "Brucellosis screening is a repeatable breeding safety test. It reflects current breeding readiness, not permanent genetic health.";

type BrucellosisDiseaseStatus = {
  diseaseCode: string;
  status: string;
};

type BrucellosisTest = {
  diseaseCode: string;
  resultCode: string;
  testedAtEpoch: number;
  validUntilEpoch: number | null;
};

function formatGameDateLabel(epoch: number): string {
  return formatUtcDateTime(epoch);
}

function formatTestedDateLabel(testedAtEpoch: number | null): string | null {
  return testedAtEpoch === null
    ? null
    : `Tested ${formatGameDateLabel(testedAtEpoch)}`;
}

function formatBrucellosisResultLabel(resultCode: string | null): string {
  switch (resultCode) {
    case "NEGATIVE":
      return "Negative";
    case "POSITIVE":
      return "Positive";
    case null:
      return "No result";
    default:
      return resultCode;
  }
}

/**
 * Builds the player-safe, current Brucellosis screening presentation shared by
 * Dog Profile and owner roster reads. Infection deliberately overrides a
 * current negative record because it is the canonical disease safety state.
 */
export function buildBrucellosisBreedingSafetyScreening(args: {
  currentEpoch: number;
  infectiousDiseaseStatuses: BrucellosisDiseaseStatus[];
  infectiousDiseaseTests: BrucellosisTest[];
}) {
  const isInfected = args.infectiousDiseaseStatuses.some(
    (status) =>
      status.diseaseCode === BRUCELLOSIS_DISEASE_CODE &&
      status.status === "INFECTED"
  );
  const brucellosisTests = args.infectiousDiseaseTests.filter(
    (test) => test.diseaseCode === BRUCELLOSIS_DISEASE_CODE
  );
  const latestTest = brucellosisTests[0] ?? null;
  const currentNegativeTest = isInfected
    ? null
    : brucellosisTests.find(
        (test) =>
          test.resultCode === "NEGATIVE" &&
          test.validUntilEpoch !== null &&
          test.validUntilEpoch >= args.currentEpoch
      ) ?? null;
  const isPositiveOrInfected =
    isInfected || latestTest?.resultCode === "POSITIVE";
  const latestValidUntilEpoch = latestTest?.validUntilEpoch ?? null;
  const currentNegativeValidUntilEpoch =
    currentNegativeTest?.validUntilEpoch ?? null;
  const validUntilLabel =
    latestValidUntilEpoch === null
      ? null
      : `${latestValidUntilEpoch >= args.currentEpoch ? "Valid through" : "Expired"} ${formatGameDateLabel(latestValidUntilEpoch)}`;
  const currentStatusLabel = isPositiveOrInfected
    ? "Positive - not cleared for breeding"
    : currentNegativeValidUntilEpoch !== null
      ? `Current negative through ${formatGameDateLabel(
          currentNegativeValidUntilEpoch
        )}`
      : latestTest
        ? "No current negative screen"
        : "Not screened";

  return [
    {
      screeningCode: BRUCELLOSIS_DISEASE_CODE as "BRUCELLOSIS",
      label: "Brucellosis Screening",
      helperText: BRUCELLOSIS_SCREENING_HELPER_TEXT,
      isRepeatable: true,
      currentStatusLabel,
      lastResultLabel: formatBrucellosisResultLabel(
        latestTest?.resultCode ?? null
      ),
      testedAtEpoch: latestTest?.testedAtEpoch ?? null,
      testedAtLabel: latestTest
        ? formatTestedDateLabel(latestTest.testedAtEpoch)
        : null,
      validUntilEpoch: latestValidUntilEpoch,
      validUntilLabel,
      isCurrentNegative: Boolean(currentNegativeTest),
      isPositiveOrInfected,
    },
  ];
}
