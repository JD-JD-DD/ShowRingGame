type HealthTestSkipReason =
  | "ALREADY_COMPLETED"
  | "TOO_YOUNG"
  | "NOT_APPLICABLE_TO_BREED"
  | "NOT_ALIVE"
  | "NOT_OWNED_OR_NOT_FOUND";

export type BulkHealthTestExecutionFeedback = {
  testedDogCount: number;
  executedTestCount: number;
  totalCharged: number;
  skippedByReason: Record<HealthTestSkipReason, number>;
};

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function formatHealthTestSkipSummary(
  skippedByReason: BulkHealthTestExecutionFeedback["skippedByReason"]
) {
  const summaries = [
    [
      skippedByReason.ALREADY_COMPLETED,
      "completed test was skipped",
      "completed tests were skipped",
    ],
    [
      skippedByReason.TOO_YOUNG,
      "test was skipped because a dog is too young",
      "tests were skipped because dogs are too young",
    ],
    [
      skippedByReason.NOT_APPLICABLE_TO_BREED,
      "test was skipped because it does not apply to the breed",
      "tests were skipped because they do not apply to the breed",
    ],
    [
      skippedByReason.NOT_ALIVE,
      "test was skipped because a dog is not currently eligible",
      "tests were skipped because dogs are not currently eligible",
    ],
    [
      skippedByReason.NOT_OWNED_OR_NOT_FOUND,
      "test was skipped because a dog is no longer available",
      "tests were skipped because dogs are no longer available",
    ],
  ] as const;

  return summaries
    .filter(([count]) => count > 0)
    .map(
      ([count, singular, plural]) =>
        `${count.toLocaleString()} ${count === 1 ? singular : plural}`
    )
    .join("; ");
}

export function formatBulkHealthTestCompletion(
  result: BulkHealthTestExecutionFeedback
) {
  const skippedSummary = formatHealthTestSkipSummary(result.skippedByReason);

  if (result.executedTestCount === 0) {
    return [
      "No health tests were run.",
      skippedSummary || "The selected tests were already completed or no longer eligible.",
    ].join(" ");
  }

  return [
    `Health testing complete: ${formatCount(result.executedTestCount, "test")} run on ${formatCount(result.testedDogCount, "dog")}.`,
    `Total charged: ${formatMoney(result.totalCharged)}.`,
    skippedSummary,
  ]
    .filter(Boolean)
    .join(" ");
}
