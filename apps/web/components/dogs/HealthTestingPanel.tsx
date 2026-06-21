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
  green: "text-emerald-200",
  yellow: "text-amber-200",
  red: "text-red-200",
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
      new Set(
        rows
          .filter(
            (row) =>
              row.result === null && canOrderHealthTests && row.isAvailable
          )
          .map((row) => row.testTypeCode)
      ),
    [canOrderHealthTests, rows]
  );
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const validSelectedCodes = selectedCodes.filter((code) =>
    selectableCodes.has(code)
  );
  const selectedTotal = rows
    .filter((row) => validSelectedCodes.includes(row.testTypeCode))
    .reduce((sum, row) => sum + row.fee, 0);
  const balanceAfter = kennelBalance - selectedTotal;
  const canRunSelected = validSelectedCodes.length > 0 && balanceAfter >= 0;

  function toggleSelected(testTypeCode: string, checked: boolean) {
    if (!selectableCodes.has(testTypeCode)) {
      return;
    }

    setSelectedCodes((current) =>
      checked
        ? [...new Set([...current, testTypeCode])]
        : current.filter((code) => code !== testTypeCode)
    );
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <div className="grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {rows.map((row) => {
          const availabilityText = row.isAvailable
            ? "Available now"
            : row.availabilityLabel;

          return (
            <div
              key={row.testTypeCode}
              className="dog-card flex min-h-[150px] flex-col justify-between gap-3 rounded-2xl px-4 py-4"
            >
              <div>
                <div className="dog-heading text-sm font-semibold">{row.label}</div>
                {row.result ? (
                  <>
                    <div
                      className={`mt-1 text-sm font-semibold ${HEALTH_SEVERITY_TEXT_STYLES[row.result.severity]}`}
                    >
                      {row.result.label}
                    </div>
                    <div className="dog-copy mt-1 text-xs">
                      {row.result.testedLabel}
                    </div>
                  </>
                ) : (
                  <div className="dog-copy mt-1 text-sm">
                    Not tested
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                {row.result ? (
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                    Complete
                  </span>
                ) : canOrderHealthTests && row.isAvailable ? (
                  <form
                    action={`/api/dogs/${dogId}/health-tests/${row.testTypeCode}`}
                    method="post"
                  >
                    {areaId ? (
                      <input type="hidden" name="areaId" value={areaId} />
                    ) : null}
                    <button
                      type="submit"
                      className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500"
                    >
                      Test {formatMoney(row.fee)}
                    </button>
                  </form>
                ) : (
                  <span className="dog-neutral-badge rounded-full px-3 py-1 text-xs opacity-70">
                    {availabilityText}
                  </span>
                )}
                {!row.result && canOrderHealthTests && row.isAvailable ? (
                  <button
                    type="button"
                    onClick={() =>
                      toggleSelected(
                        row.testTypeCode,
                        !validSelectedCodes.includes(row.testTypeCode)
                      )
                    }
                    className="dog-copy text-xs font-semibold transition hover:text-purple-400"
                  >
                    {validSelectedCodes.includes(row.testTypeCode)
                      ? "Selected"
                      : "Add"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <form
        action={`/api/dogs/${dogId}/health-tests`}
        method="post"
        className="dog-card rounded-2xl p-4"
      >
        {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
        <h3 className="dog-heading font-semibold">Test Summary</h3>

        <div className="dog-copy mt-4 space-y-2 text-sm">
          {rows.map((row) => {
            const checked = validSelectedCodes.includes(row.testTypeCode);
            const disabled =
              row.result !== null || !canOrderHealthTests || !row.isAvailable;
            const availabilityText = row.isAvailable
              ? "Available now"
              : row.availabilityLabel;

            return (
              <label
                key={`summary-${row.testTypeCode}`}
                className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 ${
                  checked
                    ? "border-purple-400/45 bg-purple-500/15"
                    : "dog-card"
                } ${disabled ? "opacity-65" : ""}`}
              >
                <span className="flex min-w-0 items-start gap-2">
                  <input
                    type="checkbox"
                    name="testTypeCodes"
                    value={row.testTypeCode}
                    checked={checked}
                    disabled={disabled}
                    onChange={(event) =>
                      toggleSelected(row.testTypeCode, event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 accent-purple-500"
                  />
                  <span className="min-w-0">
                    <span className="dog-heading block font-semibold">
                      {row.label}
                    </span>
                    <span className="dog-copy mt-0.5 block text-xs">
                      {row.result
                        ? "Already complete"
                        : availabilityText}
                    </span>
                  </span>
                </span>
                <span className="dog-heading shrink-0 font-semibold">
                  {formatMoney(row.fee)}
                </span>
              </label>
            );
          })}

          <div className="flex justify-between gap-3 pt-2">
            <span>Selected tests</span>
            <span>{validSelectedCodes.length}</span>
          </div>
          <div className="dog-heading flex justify-between gap-3 border-t border-purple-300/20 pt-2 font-semibold">
            <span>Total</span>
            <span>{formatMoney(selectedTotal)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Current balance</span>
            <span>{formatMoney(kennelBalance)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Balance after</span>
            <span
              className={balanceAfter < 0 ? "font-semibold text-red-200" : ""}
            >
              {formatMoney(balanceAfter)}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={!canRunSelected}
          className="mt-4 w-full rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Run Selected Tests
        </button>
      </form>
    </div>
  );
}
