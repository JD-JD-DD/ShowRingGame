"use client";

import { useMemo, useState } from "react";

import {
  ENTRY_FEE_PER_SHOW,
  getClusterEntryQuote,
} from "@showring/rules";

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
  conditioningSnapshot: number;
  eligibleShowDayIds: string[];
  alreadyEnteredShowDayIds: string[];
};

type PlannerProps = {
  showId: string;
  breedCode2: string;
  days: PlannerDay[];
  dogs: PlannerDog[];
  kennelBalance: number;
  homeDistrict: number;
  clusterDistrict: number;
  initiallySelectedDogIds: string[];
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
  days,
  dogs,
  kennelBalance,
  homeDistrict,
  clusterDistrict,
  initiallySelectedDogIds,
}: PlannerProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    getInitialSelection({ dogs, initiallySelectedDogIds })
  );

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

  const quote = useMemo(() => {
    const selectedDaysByDogId = new Map<string, number[]>();

    for (const pair of selectedPairs) {
      const day = days.find((candidate) => candidate.showDayId === pair.showDayId);

      if (!day) {
        continue;
      }

      const selectedDays = selectedDaysByDogId.get(pair.dogId) ?? [];
      selectedDays.push(day.dayIndex);
      selectedDaysByDogId.set(pair.dogId, selectedDays);
    }

    return getClusterEntryQuote({
      homeDistrict,
      clusterDistrict,
      ledgerBalance: kennelBalance,
      dogs: dogs.map((dog) => ({
        dogId: dog.dogId,
        dogName: dog.displayName,
        breed: breedCode2,
        sex: dog.sex === "M" ? "Dog" : "Bitch",
        selectedShowDays: selectedDaysByDogId.get(dog.dogId) ?? [],
      })),
    });
  }, [breedCode2, clusterDistrict, days, dogs, homeDistrict, kennelBalance, selectedPairs]);

  function setDogSelection(dog: PlannerDog, isSelected: boolean) {
    setSelected((current) => {
      const next = { ...current };

      for (const showDayId of dog.eligibleShowDayIds) {
        next[selectionKey(dog.dogId, showDayId)] = isSelected;
      }

      return next;
    });
  }

  return (
    <form action={`/api/shows/${showId}/enter`} method="post" className="mt-6">
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
        <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-purple-200/75">
              <th className="px-3 py-2">Dog</th>
              <th className="px-3 py-2">Sex</th>
              <th className="px-3 py-2">Age</th>
              <th className="px-3 py-2">Condition</th>
              {days.map((day) => (
                <th key={day.showDayId} className="w-28 px-3 py-2 text-center">
                  Day {day.dayIndex}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Quick</th>
            </tr>
          </thead>
          <tbody>
            {dogs.map((dog) => (
              <tr
                key={dog.dogId}
                className="border border-white/10 bg-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
              >
                <td className="rounded-l-2xl px-3 py-3">
                  <div className="font-semibold text-white">{dog.displayName}</div>
                  <div className="text-xs text-purple-100/55">{dog.regNumber}</div>
                </td>
                <td className="px-3 py-3 text-purple-100/75">{dog.sex}</td>
                <td className="px-3 py-3 text-purple-100/75">{dog.ageLabel}</td>
                <td className="px-3 py-3 text-purple-100/75">
                  {dog.conditioningSnapshot}
                </td>
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
                          disabled={!isEligible}
                          onChange={(event) =>
                            setSelected((current) => ({
                              ...current,
                              [key]: event.target.checked,
                            }))
                          }
                          className="h-5 w-5 accent-purple-500 disabled:opacity-30"
                          aria-label={`Enter ${dog.displayName} on day ${day.dayIndex}`}
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
                      className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setDogSelection(dog, false)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-purple-100 transition hover:bg-white/10"
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

      <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-2 text-sm text-purple-100/75 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-purple-200/60">
              Entries
            </div>
            <div className="mt-1 font-semibold text-white">
              {quote.totalEntries} x {formatMoney(ENTRY_FEE_PER_SHOW)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-purple-200/60">
              Entry Fees
            </div>
            <div className="mt-1 font-semibold text-white">
              {formatMoney(quote.entryFees)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-purple-200/60">
              Travel
            </div>
            <div className="mt-1 font-semibold text-white">
              {formatMoney(quote.travel.totalCost)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-purple-200/60">
              Handler
            </div>
            <div className="mt-1 font-semibold text-white">
              {formatMoney(quote.handlerFee)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-purple-200/60">
              After Entry
            </div>
            <div
              className={`mt-1 font-semibold ${
                quote.canAfford ? "text-white" : "text-red-100"
              }`}
            >
              {formatMoney(quote.ledgerBalanceAfterEntry)}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={selectedPairs.length === 0 || !quote.canAfford}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-purple-100/45"
        >
          Submit {selectedPairs.length} Entr{selectedPairs.length === 1 ? "y" : "ies"}
        </button>
      </div>

      {!quote.canAfford ? (
        <div className="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Shortfall: {formatMoney(quote.shortfall)}
        </div>
      ) : null}
    </form>
  );
}
