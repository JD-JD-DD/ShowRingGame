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

const RESULT_NAME_STYLES: Record<"green" | "yellow" | "red", string> = {
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
  const availableCodes = useMemo(
    () =>
      rows
        .filter((row) => !row.result && row.isAvailable && canOrderHealthTests)
        .map((row) => row.testTypeCode),
    [canOrderHealthTests, rows]
  );
  const availableCodeSet = useMemo(() => new Set(availableCodes), [availableCodes]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const validSelectedCodes = selectedCodes.filter((code) => availableCodeSet.has(code));
  const selectedTotal = rows
    .filter((row) => validSelectedCodes.includes(row.testTypeCode))
    .reduce((total, row) => total + row.fee, 0);
  const balanceAfter = kennelBalance - selectedTotal;
  const allSelected =
    availableCodes.length > 0 &&
    availableCodes.every((code) => validSelectedCodes.includes(code));

  function toggleCode(code: string, checked: boolean) {
    if (!availableCodeSet.has(code)) return;
    setSelectedCodes((current) =>
      checked
        ? [...new Set([...current, code])]
        : current.filter((currentCode) => currentCode !== code)
    );
  }

  return (
    <form action={`/api/dogs/${dogId}/health-tests`} method="post" className="dog-card overflow-hidden rounded-2xl">
      {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
      {validSelectedCodes.map((code) => (
        <input key={code} type="hidden" name="testTypeCodes" value={code} />
      ))}

      <div className="divide-y divide-[var(--dog-border)]">
        {rows.map((row) => {
          const selectable = availableCodeSet.has(row.testTypeCode);
          const checked = validSelectedCodes.includes(row.testTypeCode);
          const nameClass = row.result
            ? RESULT_NAME_STYLES[row.result.severity]
            : "dog-heading";

          return (
            <label
              key={row.testTypeCode}
              className={`flex items-center gap-3 px-3 py-2.5 ${selectable ? "cursor-pointer" : "cursor-default"}`}
            >
              {row.result ? (
                <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RESULT_NAME_STYLES[row.result.severity]}`} aria-label="Complete">
                  ✓
                </span>
              ) : (
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!selectable}
                  onChange={(event) => toggleCode(row.testTypeCode, event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-purple-600"
                />
              )}

              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${nameClass}`}>
                  {row.label}
                </span>
                <span className="dog-copy block truncate text-[11px]">
                  {row.result
                    ? `${row.result.label} · ${row.result.testedLabel}`
                    : row.isAvailable
                      ? "Available now"
                      : row.availabilityLabel}
                </span>
              </span>
              <span className="dog-heading shrink-0 text-xs font-semibold">
                {formatMoney(row.fee)}
              </span>
            </label>
          );
        })}
      </div>

      {canOrderHealthTests ? (
        <div className="border-t border-[var(--dog-border)] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setSelectedCodes(allSelected ? [] : availableCodes)}
              className="dog-secondary-button rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            >
              {allSelected ? "Clear all" : "Select all available"}
            </button>
            <span className="dog-heading text-sm font-semibold">
              Total: {formatMoney(selectedTotal)}
            </span>
          </div>
          <div className="dog-copy mt-2 flex justify-between gap-3 text-xs">
            <span>{validSelectedCodes.length} selected</span>
            <span>
              Balance after: {formatMoney(balanceAfter)}
            </span>
          </div>
          <button
            type="submit"
            disabled={validSelectedCodes.length === 0 || balanceAfter < 0}
            className="mt-3 w-full rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Run Selected Tests
          </button>
        </div>
      ) : null}
    </form>
  );
}
