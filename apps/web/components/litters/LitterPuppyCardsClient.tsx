"use client";

import { useEffect, useMemo, useState } from "react";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";
import { LitterPuppyCard } from "@/components/litters/LitterPuppyCard";
import { LitterPuppyNameWorkspace } from "@/components/litters/LitterPuppyNameWorkspace";

type PuppySelectionItem = Pick<
  LitterPuppyDto,
  "dogId" | "isManageableByBreeder"
>;

function getManageablePuppyIds(puppies: PuppySelectionItem[]): Set<string> {
  return new Set(
    puppies
      .filter((puppy) => puppy.isManageableByBreeder)
      .map((puppy) => puppy.dogId)
  );
}

function reconcileSelectedPuppyIds(
  selectedPuppyIds: Set<string>,
  manageablePuppyIds: Set<string>
): Set<string> {
  return new Set(
    [...selectedPuppyIds].filter((puppyId) => manageablePuppyIds.has(puppyId))
  );
}

function usePuppySelectionState(puppies: PuppySelectionItem[]) {
  const manageablePuppyIds = useMemo(
    () => getManageablePuppyIds(puppies),
    [puppies]
  );
  const manageablePuppyIdsKey = [...manageablePuppyIds].sort().join(",");
  const [selectedPuppyIds, setSelectedPuppyIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    setSelectedPuppyIds((current) =>
      reconcileSelectedPuppyIds(current, manageablePuppyIds)
    );
  }, [manageablePuppyIds, manageablePuppyIdsKey]);

  return {
    selectedPuppyIds,
    selectedCount: selectedPuppyIds.size,
    selectPuppy(puppyId: string) {
      if (!manageablePuppyIds.has(puppyId)) return;
      setSelectedPuppyIds((current) => new Set([...current, puppyId]));
    },
    selectSinglePuppy(puppyId: string) {
      if (!manageablePuppyIds.has(puppyId)) return;
      setSelectedPuppyIds(new Set([puppyId]));
    },
    deselectPuppy(puppyId: string) {
      setSelectedPuppyIds((current) => {
        const next = new Set(current);
        next.delete(puppyId);
        return next;
      });
    },
    selectAllManageablePuppies() {
      setSelectedPuppyIds(new Set(manageablePuppyIds));
    },
    clearSelection() {
      setSelectedPuppyIds(new Set());
    },
  };
}

export function LitterPuppyCardsClient({
  litterId,
  puppies,
}: {
  litterId: string;
  puppies: LitterPuppyDto[];
}) {
  const selectionState = usePuppySelectionState(puppies);
  const selectedPuppyId = [...selectionState.selectedPuppyIds][0] ?? null;
  const selectedPuppy =
    puppies.find((puppy) => puppy.dogId === selectedPuppyId) ?? null;
  const [activeAction, setActiveAction] = useState<"name" | null>(null);

  function clearSelection() {
    setActiveAction(null);
    selectionState.clearSelection();
  }

  function selectPuppy(puppyId: string, selected: boolean) {
    if (selected) {
      if (selectedPuppyId !== puppyId) setActiveAction(null);
      selectionState.selectSinglePuppy(puppyId);
      return;
    }

    setActiveAction(null);
    selectionState.deselectPuppy(puppyId);
  }

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-2">
        {puppies.map((puppy) => (
          <LitterPuppyCard
            key={puppy.dogId}
            puppy={puppy}
            isSelected={selectedPuppyId === puppy.dogId}
            onSelectionChange={(selected) => selectPuppy(puppy.dogId, selected)}
          />
        ))}
      </div>

      {selectedPuppy ? (
        <>
          <section className="theme-card mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" aria-live="polite">
            <p className="theme-heading text-sm font-semibold">1 puppy selected</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveAction("name")}
                disabled={!selectedPuppy.actionEligibility.canName}
                className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Name
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Clear selection
              </button>
            </div>
            {!selectedPuppy.actionEligibility.canName &&
            selectedPuppy.actionEligibility.nameDisabledReason ? (
              <p className="theme-status-danger basis-full rounded-xl px-3 py-2 text-sm">
                {selectedPuppy.actionEligibility.nameDisabledReason}
              </p>
            ) : null}
          </section>

          {activeAction === "name" ? (
            <LitterPuppyNameWorkspace
              litterId={litterId}
              puppy={selectedPuppy}
              onClose={() => setActiveAction(null)}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
