import { BRUCELLOSIS_TEST_FEE } from "@showring/rules";

import type { DogProfileDto } from "@/server/mappers/dog.mapper";

import HealthTestingPanel from "./HealthTestingPanel";

type Props = {
  profile: DogProfileDto;
  kennelRunId: string | null;
  canManage: boolean;
  healthMessage: string | null;
  healthError: string | null;
};

function withKennelRunContext(action: string, kennelRunId: string | null) {
  if (!kennelRunId) return action;

  const url = new URL(action, "http://dog-page.local");
  url.searchParams.set("kennelRunId", kennelRunId);
  return `${url.pathname}${url.search}${url.hash}`;
}

function statusMessage(message: string | null, isError = false) {
  if (!message) return null;

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        isError
          ? "theme-notice theme-notice--danger"
          : "theme-notice theme-notice--success"
      }`}
    >
      {message}
    </div>
  );
}

function formatBreedingSafetyCost(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export default function DogProfileHealthActions({
  profile,
  kennelRunId,
  canManage,
  healthMessage,
  healthError,
}: Props) {
  const { header, healthTesting } = profile;
  const healthControls = healthTesting.ownerControls;

  if (!canManage) return null;

  return (
    <div className="mt-6 space-y-4">
      {statusMessage(healthMessage)}
      {statusMessage(healthError, true)}
      <HealthTestingPanel
        action={`/api/dogs/${header.dogId}/health-tests${kennelRunId ? `?kennelRunId=${encodeURIComponent(kennelRunId)}` : ""}`}
        kennelBalance={healthControls?.kennelBalance ?? 0}
        canOrderHealthTests={Boolean(healthControls?.checkoutNeeded)}
        rows={healthTesting.tests.map((test) => ({
          testTypeCode: test.testCode,
          label: test.displayName,
          fee: test.cost,
          isAvailable: test.isCurrentlyAvailable,
          availabilityLabel: test.minimumAgeLabel,
          result: test.isComplete
            ? {
                label: test.resultLabel ?? "Complete",
                testedLabel: test.testedDateLabel ?? "Test date unavailable",
                severity: test.severityKey ?? "yellow",
                impactStatement: test.healthImpactStatement,
              }
            : null,
        }))}
      />
      {healthTesting.breedingSafetyScreening.length > 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
          <div className="dog-heading text-sm font-semibold">
            Breeding Safety Screening
          </div>
          <div className="mt-3 grid gap-3">
            {healthTesting.breedingSafetyScreening.map((screening) => (
              <div
                key={screening.screeningCode}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-inset)] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="dog-heading text-sm font-semibold">
                      {screening.label}
                    </div>
                    <div className="dog-copy mt-1 text-xs leading-5">
                      {screening.helperText}
                    </div>
                  </div>
                  <span className="dog-neutral-badge rounded-full px-2.5 py-1 text-[11px] font-semibold">
                    Repeatable
                  </span>
                </div>
                <div className="dog-copy mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {screening.isCurrentNegative && screening.validUntilLabel ? (
                    <span>{screening.validUntilLabel}</span>
                  ) : null}
                  {!screening.isCurrentNegative && screening.testedAtLabel ? (
                    <>
                      <span>Last result: {screening.lastResultLabel}</span>
                      <span>{screening.testedAtLabel}</span>
                    </>
                  ) : null}
                  {!screening.isCurrentNegative && screening.validUntilLabel ? (
                    <span>{screening.validUntilLabel}</span>
                  ) : null}
                </div>
                <form
                  action={withKennelRunContext(
                    `/api/dogs/${header.dogId}/brucellosis-screening`,
                    kennelRunId
                  )}
                  method="post"
                  className="mt-3"
                >
                  <button
                    type="submit"
                    className="theme-primary-button w-full rounded-xl px-4 py-2 text-xs font-semibold"
                  >
                    {screening.isCurrentNegative
                      ? "Repeat Screening"
                      : "Run Brucellosis Screening"}{" "}
                    <span className="ml-2 text-[var(--color-primary-foreground)]">
                      {formatBreedingSafetyCost(BRUCELLOSIS_TEST_FEE)}
                    </span>
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
