"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";

import {
  ENTRY_FEE_PER_SHOW,
  getClusterEntryQuote,
  getDistanceTierLabel,
} from "@showring/rules";
import DogStatusBadges from "@/components/dogs/DogStatusBadges";

type PlannerDay = {
  showDayId: string;
  dayIndex: number;
  label: string;
  judgeName: string;
  status: string;
};

type PlannerDog = {
  dogId: string;
  displayName: string;
  regNumber: string;
  sex: "M" | "F";
  ageLabel: string;
  eligibleShowDayIds: string[];
  alreadyEnteredShowDayIds: string[];
  hasAllGreenHealthTests: boolean;
  healthBadgeStatus: "green" | "yellow" | "red" | null;
  isListedForSale: boolean;
  isListedAtStud: boolean;
  hasPendingEmergencyCare: boolean;
  pendingEmergencyDogUrl: string | null;
  pendingEmergencyBlockReason: string | null;
};

type PlannerProps = {
  showId: string;
  breedCode2: string;
  breedLabel: string;
  days: PlannerDay[];
  dogs: PlannerDog[];
  kennelBalance: number;
  homeDistrict: number;
  clusterDistrict: number;
  showRole: "PRIMARY" | "SECONDARY";
  travelCostAlreadyPlanned: boolean;
  existingDogIdsForBreed: string[];
  initiallySelectedDogIds: string[];
  bulkEligibleSelections: Array<{ dogId: string; showDayId: string }>;
  bulkSkippedSelectionCount: number;
};

function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

function selectionKey(dogId: string, showDayId: string): string {
  return `${dogId}:${showDayId}`;
}

function getInitialSelection(args: {
  dogs: PlannerDog[];
  initiallySelectedDogIds: string[];
}): Record<string, boolean> {
  const selectedDogIds = new Set(args.initiallySelectedDogIds);
  const selected: Record<string, boolean> = {};

  if (selectedDogIds.size === 0) {
    return selected;
  }

  for (const dog of args.dogs) {
    if (!selectedDogIds.has(dog.dogId)) {
      continue;
    }

    for (const showDayId of dog.eligibleShowDayIds) {
      selected[selectionKey(dog.dogId, showDayId)] = true;
    }
  }

  return selected;
}

export function ShowEntryPlanner({
  showId,
  breedCode2,
  breedLabel,
  days,
  dogs,
  kennelBalance,
  homeDistrict,
  clusterDistrict,
  showRole,
  travelCostAlreadyPlanned,
  existingDogIdsForBreed,
  initiallySelectedDogIds,
  bulkEligibleSelections,
  bulkSkippedSelectionCount,
}: PlannerProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    getInitialSelection({ dogs, initiallySelectedDogIds })
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBulkConfirmation, setShowBulkConfirmation] = useState(false);
  const submittingRef = useRef(false);

  const selectedPairs = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, isSelected]) => isSelected)
        .map(([key]) => {
          const [dogId, showDayId] = key.split(":");
          return { dogId, showDayId };
        })
        .filter((pair) => pair.dogId && pair.showDayId),
    [selected]
  );

  const buildQuote = useMemo(
    () => (pairs: Array<{ dogId: string; showDayId: string }>) => {
      const selectedDaysByDogId = new Map<string, number[]>();

      for (const pair of pairs) {
        const day = days.find(
          (candidate) => candidate.showDayId === pair.showDayId
        );

        if (!day) {
          continue;
        }

        const selectedDays = selectedDaysByDogId.get(pair.dogId) ?? [];
        selectedDays.push(day.dayIndex);
        selectedDaysByDogId.set(pair.dogId, selectedDays);
      }

      const baseQuote = getClusterEntryQuote({
        homeDistrict,
        clusterDistrict,
        ledgerBalance: kennelBalance,
        showRole,
        existingDogIdsByBreed: {
          [breedCode2]: existingDogIdsForBreed,
        },
        dogs: dogs.map((dog) => ({
          dogId: dog.dogId,
          dogName: dog.displayName,
          breed: breedCode2,
          sex: dog.sex === "M" ? "Dog" : "Bitch",
          selectedShowDays: selectedDaysByDogId.get(dog.dogId) ?? [],
        })),
      });
      const travelCost = travelCostAlreadyPlanned ? 0 : baseQuote.travel.totalCost;
      const totalCost = baseQuote.entryFees + travelCost + baseQuote.handlerFee;
      const ledgerBalanceAfterEntry = kennelBalance - totalCost;
      const shortfall =
        ledgerBalanceAfterEntry < 0 ? Math.abs(ledgerBalanceAfterEntry) : 0;

      return {
        ...baseQuote,
        travel: {
          ...baseQuote.travel,
          totalCost: travelCost,
        },
        totalCost,
        ledgerBalanceAfterEntry,
        shortfall,
        canAfford: ledgerBalanceAfterEntry >= 0,
      };
    },
    [
      breedCode2,
      clusterDistrict,
      days,
      dogs,
      existingDogIdsForBreed,
      homeDistrict,
      kennelBalance,
      showRole,
      travelCostAlreadyPlanned,
    ]
  );

  const quote = useMemo(() => {
    return buildQuote(selectedPairs);
  }, [buildQuote, selectedPairs]);

  const bulkQuote = useMemo(() => buildQuote(bulkEligibleSelections), [
    buildQuote,
    bulkEligibleSelections,
  ]);
  const bulkEligibleDogCount = useMemo(
    () => new Set(bulkEligibleSelections.map((pair) => pair.dogId)).size,
    [bulkEligibleSelections]
  );
  const bulkEligibleShowDayCount = useMemo(
    () => new Set(bulkEligibleSelections.map((pair) => pair.showDayId)).size,
    [bulkEligibleSelections]
  );
  const hasBulkSelections = bulkEligibleSelections.length > 0;

  function handleBulkSubmit(event: FormEvent<HTMLFormElement>) {
    if (submittingRef.current || !hasBulkSelections || !bulkQuote.canAfford) {
      event.preventDefault();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
  }

  function setDogSelection(dog: PlannerDog, isSelected: boolean) {
    if (dog.hasPendingEmergencyCare) {
      return;
    }

    setSelected((current) => {
      const next = { ...current };

      for (const showDayId of dog.eligibleShowDayIds) {
        next[selectionKey(dog.dogId, showDayId)] = isSelected;
      }

      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (submittingRef.current || selectedPairs.length === 0 || !quote.canAfford) {
      event.preventDefault();
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
  }

  return (
    <div className="mt-6">
      <form
        action={`/api/shows/${showId}/enter`}
        method="post"
        onSubmit={handleSubmit}
      >
        <input type="hidden" name="breedCode2" value={breedCode2} />
        {selectedPairs.map((pair) => (
          <input
            key={`${pair.dogId}-${pair.showDayId}`}
            type="hidden"
            name="dogDaySelections"
            value={`${pair.dogId}:${pair.showDayId}`}
          />
        ))}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="theme-label text-left text-xs uppercase tracking-[0.16em]">
              <th className="px-3 py-2">Dog</th>
              <th className="px-3 py-2">Sex</th>
              <th className="px-3 py-2">Age</th>
              {days.map((day) => (
                <th key={day.showDayId} className="w-28 px-3 py-2 text-center">
                  <div>Day {day.dayIndex}</div>
                  <div className="theme-copy mt-1 normal-case tracking-normal">
                    {day.label}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right">Quick</th>
            </tr>
          </thead>
          <tbody>
            {dogs.map((dog) => (
              <tr
                key={dog.dogId}
                className="theme-card"
              >
                <td className="rounded-l-2xl px-3 py-3">
                  <div className="theme-heading flex items-center gap-1.5 font-semibold">
                    <span>{dog.displayName}</span>
                    <DogStatusBadges
                      healthStatus={dog.healthBadgeStatus}
                      fullHealthClearance={dog.hasAllGreenHealthTests}
                      isListedForSale={dog.isListedForSale}
                      isListedAtStud={dog.isListedAtStud}
                    />
                    {dog.hasPendingEmergencyCare ? (
                      <Link
                        href={dog.pendingEmergencyDogUrl ?? `/dogs/${dog.dogId}`}
                        className="inline-flex shrink-0 rounded-full border border-red-300/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-100 transition hover:border-red-200/60 hover:bg-red-500/25"
                      >
                        Emergency
                      </Link>
                    ) : null}
                  </div>
                  <div className="theme-copy text-xs">{dog.regNumber}</div>
                  {dog.hasPendingEmergencyCare ? (
                    <div className="mt-1 max-w-xs text-xs font-medium text-red-100">
                      Emergency vet care must be resolved before this dog can be entered.
                    </div>
                  ) : null}
                </td>
                <td className="theme-copy px-3 py-3">{dog.sex}</td>
                <td className="theme-copy px-3 py-3">{dog.ageLabel}</td>
                {days.map((day) => {
                  const key = selectionKey(dog.dogId, day.showDayId);
                  const isEligible = dog.eligibleShowDayIds.includes(day.showDayId);
                  const isEntered = dog.alreadyEnteredShowDayIds.includes(day.showDayId);

                  return (
                    <td key={day.showDayId} className="px-3 py-3 text-center">
                      {isEntered ? (
                        <span className="inline-flex min-w-20 justify-center rounded-full border border-sky-300/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100">
                          Entered
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={Boolean(selected[key])}
                          disabled={
                            isSubmitting ||
                            !isEligible ||
                            dog.hasPendingEmergencyCare
                          }
                          onChange={(event) =>
                            setSelected((current) => ({
                              ...current,
                              [key]: event.target.checked,
                            }))
                          }
                          className="h-5 w-5 accent-purple-500 disabled:opacity-30"
                          aria-label={
                            dog.hasPendingEmergencyCare
                              ? dog.pendingEmergencyBlockReason ??
                                `Emergency vet care must be resolved before ${dog.displayName} can be entered.`
                              : `Enter ${dog.displayName} on day ${day.dayIndex}`
                          }
                        />
                      )}
                    </td>
                  );
                })}
                <td className="rounded-r-2xl px-3 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDogSelection(dog, true)}
                      disabled={isSubmitting || dog.hasPendingEmergencyCare}
                      className="rounded-xl border border-emerald-300/40 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:border-emerald-200/60 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-700/60 disabled:text-slate-200"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setDogSelection(dog, false)}
                      disabled={isSubmitting}
                      className="rounded-xl border border-[var(--dog-border)] bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:border-slate-500/40 disabled:bg-slate-700/60 disabled:text-slate-200"
                    >
                      Clear
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 border-t border-[color:var(--dog-border)] pt-5 md:grid-cols-[1fr_auto] md:items-end">
        <div className="theme-copy grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="theme-label text-xs uppercase tracking-[0.14em]">
              Entries
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {quote.totalEntries} x {formatMoney(ENTRY_FEE_PER_SHOW)}
            </div>
          </div>
          <div>
            <div className="theme-label text-xs uppercase tracking-[0.14em]">
              Entry Fees
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {formatMoney(quote.entryFees)}
            </div>
          </div>
          <div>
            <div className="theme-label text-xs uppercase tracking-[0.14em]">
              {getDistanceTierLabel(quote.travel.tier)} Travel
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {formatMoney(quote.travel.totalCost)}
            </div>
          </div>
          <div>
            <div className="theme-label text-xs uppercase tracking-[0.14em]">
              {quote.handlerFeeType === "TRAVELING" ? "Travel Handler" : "Handler"}
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {quote.handlerDogs > 0
                ? `${quote.handlerDogs} x ${formatMoney(
                    quote.handlerFee / quote.handlerDogs
                  )}`
                : formatMoney(quote.handlerFee)}
            </div>
          </div>
          <div>
            <div className="theme-label text-xs uppercase tracking-[0.14em]">
              After Entry
            </div>
            <div
              className={`mt-1 font-semibold ${
                quote.canAfford ? "theme-heading" : "text-red-100"
              }`}
            >
              {formatMoney(quote.ledgerBalanceAfterEntry)}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || selectedPairs.length === 0 || !quote.canAfford}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-200"
        >
          {isSubmitting
            ? "Submitting..."
            : `Submit ${selectedPairs.length} Entr${
                selectedPairs.length === 1 ? "y" : "ies"
              }`}
        </button>
      </div>

      {!quote.canAfford ? (
        <div className="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Shortfall: {formatMoney(quote.shortfall)}
        </div>
      ) : null}

      </form>

      <div className="mt-8 rounded-[24px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="theme-heading text-lg font-semibold">
              Enter All Eligible Dogs
            </div>
            <p className="theme-copy mt-1 text-sm">
              Enter every currently eligible {breedLabel} in this cluster across
              all open days, then confirm the full quote before submission.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowBulkConfirmation((current) => !current)}
            disabled={isSubmitting || !hasBulkSelections}
            className="rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-200"
          >
            Enter All Eligible Dogs
          </button>
        </div>

        {!hasBulkSelections ? (
          <div className="theme-copy mt-4 rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-panel)] px-4 py-3 text-sm">
            No new eligible dog/day combinations are available for this breed in
            the current cluster.
          </div>
        ) : null}

        {showBulkConfirmation && hasBulkSelections ? (
          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/8 p-4">
            <div className="theme-heading text-base font-semibold">
              Bulk Entry Confirmation
            </div>
            <div className="theme-copy mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.14em]">
                  Unique Dogs
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {bulkEligibleDogCount}
                </div>
              </div>
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.14em]">
                  Show Days
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {bulkEligibleShowDayCount}
                </div>
              </div>
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.14em]">
                  Total Entries
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {bulkEligibleSelections.length}
                </div>
              </div>
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.14em]">
                  Skipped
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {bulkSkippedSelectionCount}
                </div>
              </div>
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.14em]">
                  Entry Fees
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {formatMoney(bulkQuote.entryFees)}
                </div>
              </div>
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.14em]">
                  Travel Charges
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {formatMoney(bulkQuote.travel.totalCost)}
                </div>
              </div>
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.14em]">
                  Handler Charges
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {formatMoney(bulkQuote.handlerFee)}
                </div>
              </div>
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.14em]">
                  Total Charge
                </div>
                <div className="theme-heading mt-1 font-semibold">
                  {formatMoney(bulkQuote.totalCost)}
                </div>
              </div>
              <div>
                <div className="theme-label text-xs uppercase tracking-[0.14em]">
                  Balance After Entry
                </div>
                <div
                  className={`mt-1 font-semibold ${
                    bulkQuote.canAfford ? "theme-heading" : "text-red-100"
                  }`}
                >
                  {formatMoney(bulkQuote.ledgerBalanceAfterEntry)}
                </div>
              </div>
            </div>

            {!bulkQuote.canAfford ? (
              <div className="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                Shortfall: {formatMoney(bulkQuote.shortfall)}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <form
                action={`/api/shows/${showId}/enter`}
                method="post"
                onSubmit={handleBulkSubmit}
              >
                <input type="hidden" name="breedCode2" value={breedCode2} />
                <input type="hidden" name="entryMode" value="ALL_ELIGIBLE" />
                {bulkEligibleSelections.map((pair) => (
                  <input
                    key={`bulk-${pair.dogId}-${pair.showDayId}`}
                    type="hidden"
                    name="dogDaySelections"
                    value={`${pair.dogId}:${pair.showDayId}`}
                  />
                ))}
                <button
                  type="submit"
                  disabled={isSubmitting || !bulkQuote.canAfford}
                  className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-200"
                >
                  {isSubmitting ? "Submitting..." : "Confirm All Entries"}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
