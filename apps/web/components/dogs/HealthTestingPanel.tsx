"use client";

import { useMemo, useState } from "react";

type HealthTestPanelRow = {
  testTypeCode: string;
  label: string;
  fee: number;
  isAvailable: boolean;
  availabilityLabel: string;
  result: {
    label: string;
    testedLabel: string;
    severity: "green" | "yellow" | "red";
  } | null;
};

type HealthTestingPanelProps = {
  dogId: string;
  areaId: string | null;
  rows: HealthTestPanelRow[];
  canOrderHealthTests: boolean;
  kennelBalance: number;
};

const HEALTH_SEVERITY_TEXT_STYLES: Record<"green" | "yellow" | "red", string> = {
  green: "text-emerald-700 dark:text-emerald-200",
  yellow: "text-amber-700 dark:text-amber-200",
  red: "text-red-700 dark:text-red-200",
};

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export default function HealthTestingPanel({
  dogId,
  areaId,
  rows,
  canOrderHealthTests,
  kennelBalance,
}: HealthTestingPanelProps) {
  const selectableCodes = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            row.result === null && canOrderHealthTests && row.isAvailable
        )
        .map((row) => row.testTypeCode),
    [canOrderHealthTests, rows]
  );
  const selectableCodeSet = useMemo(
    () => new Set(selectableCodes),
    [selectableCodes]
  );
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const validSelectedCodes = selectedCodes.filter((code) =>
    selectableCodeSet.has(code)
  );
  const selectedTotal = rows
    .filter((row) => validSelectedCodes.includes(row.testTypeCode))
    .reduce((sum, row) => sum + row.fee, 0);
  const balanceAfter = kennelBalance - selectedTotal;
  const canRunSelected = validSelectedCodes.length > 0 && balanceAfter >= 0;
  const allAvailableSelected =
    selectableCodes.length > 0 &&
    selectableCodes.every((code) => validSelectedCodes.includes(code));

  function toggleSelected(testTypeCode: string, checked: boolean) {
    if (!selectableCodeSet.has(testTypeCode)) return;
    setSelectedCodes((current) =>
      checked
        ? [...new Set([...current, testTypeCode])]
        : current.filter((code) => code !== testTypeCode)
    );
  }

  function toggleAllAvailable() {
    setSelectedCodes(allAvailableSelected ? [] : selectableCodes);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.38fr)]">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {rows.map((row) => {
          const checked = validSelectedCodes.includes(row.testTypeCode);
          const selectable = selectableCodeSet.has(row.testTypeCode);
          const canAffordIndividual = row.fee <= kennelBalance;
          const nameClass = row.result
            ? HEALTH_SEVERITY_TEXT_STYLES[row.result.severity]
            : "dog-heading";

          return (
            <article
              key={row.testTypeCode}
              className="dog-card flex min-h-[170px] flex-col justify-between gap-4 rounded-2xl p-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className={`text-sm font-semibold ${nameClass}`}>{row.label}</h3>
                    <p className="dog-copy mt-1 text-xs">
                      {row.isAvailable ? "Available now" : row.availabilityLabel}
                    </p>
                  </div>
                  <span className="dog-heading shrink-0 text-sm font-semibold">
                    {formatMoney(row.fee)}
                  </span>
                </div>
                {row.result ? (
                  <div className="mt-3">
                    <div className={`text-sm font-semibold ${HEALTH_SEVERITY_TEXT_STYLES[row.result.severity]}`}>
                      {row.result.label}
                    </div>
                    <div className="dog-copy mt-1 text-xs">{row.result.testedLabel}</div>
                  </div>
                ) : (
                  <div className="dog-copy mt-3 text-sm">Not tested</div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className={`flex items-center gap-2 text-xs font-semibold ${selectable ? "dog-heading" : "dog-copy opacity-60"}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!selectable}
                    onChange={(event) => toggleSelected(row.testTypeCode, event.target.checked)}
                    className="h-4 w-4 accent-purple-600"
                  />
                  {row.result ? "Complete" : row.isAvailable ? "Select for batch" : "Age restricted"}
                </label>

                {!row.result && row.isAvailable && canOrderHealthTests ? (
                  <form action={`/api/dogs/${dogId}/health-tests/${row.testTypeCode}`} method="post">
                    {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
                    <button
                      type="submit"
                      disabled={!canAffordIndividual}
                      className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {canAffordIndividual ? "Run test" : "Insufficient funds"}
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {canOrderHealthTests ? (
        <form
          action={`/api/dogs/${dogId}/health-tests`}
          method="post"
          className="dog-card self-start rounded-2xl p-5"
        >
          {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
          {validSelectedCodes.map((code) => (
            <input key={code} type="hidden" name="testTypeCodes" value={code} />
          ))}

          <div className="flex items-center justify-between gap-3">
            <h3 className="dog-heading font-semibold">Batch summary</h3>
            <button
              type="button"
              onClick={toggleAllAvailable}
              disabled={selectableCodes.length === 0}
              className="dog-secondary-button rounded-xl px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              {allAvailableSelected ? "Clear all" : "Select all available"}
            </button>
          </div>

          <div className="dog-copy mt-5 space-y-3 text-sm">
            <SummaryRow label="Selected tests" value={String(validSelectedCodes.length)} />
            <SummaryRow label="Total cost" value={formatMoney(selectedTotal)} emphasized />
            <SummaryRow label="Current balance" value={formatMoney(kennelBalance)} />
            <SummaryRow
              label="Balance after"
              value={formatMoney(balanceAfter)}
              valueClassName={balanceAfter < 0 ? "font-semibold text-red-700 dark:text-red-200" : undefined}
            />
          </div>

          {balanceAfter < 0 ? (
            <p className="mt-3 text-xs font-medium text-red-700 dark:text-red-200">
              Remove one or more tests to stay within the kennel balance.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canRunSelected}
            className="mt-5 w-full rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Run Selected Tests
          </button>
        </form>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasized = false,
  valueClassName = "",
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className={`flex justify-between gap-3 ${emphasized ? "dog-heading border-t border-[var(--dog-border)] pt-3 font-semibold" : ""}`}>
      <span>{label}</span>
      <span className={valueClassName}>{value}</span>
    </div>
  );
}
