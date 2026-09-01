"use client";

import { useEffect, useMemo, useState } from "react";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";
import { LitterPuppyCard } from "@/components/litters/LitterPuppyCard";

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
  puppies,
}: {
  puppies: LitterPuppyDto[];
}) {
  const selectionState = usePuppySelectionState(puppies);
  const selectedPuppyId = [...selectionState.selectedPuppyIds][0] ?? null;

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-2">
        {puppies.map((puppy) => (
          <LitterPuppyCard
            key={puppy.dogId}
            puppy={puppy}
            isSelected={selectedPuppyId === puppy.dogId}
            onSelectionChange={(selected) =>
              selected
                ? selectionState.selectSinglePuppy(puppy.dogId)
                : selectionState.deselectPuppy(puppy.dogId)
            }
          />
        ))}
      </div>

      {selectedPuppyId ? (
        <section className="theme-card mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" aria-live="polite">
          <p className="theme-heading text-sm font-semibold">1 puppy selected</p>
          <button
            type="button"
            onClick={selectionState.clearSelection}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          >
            Clear selection
          </button>
        </section>
      ) : null}
    </div>
  );
}
