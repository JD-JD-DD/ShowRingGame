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
  void selectionState;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {puppies.map((puppy) => (
        <LitterPuppyCard key={puppy.dogId} puppy={puppy} />
      ))}
    </div>
  );
}
