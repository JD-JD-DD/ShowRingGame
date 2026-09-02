"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";
import { LitterPuppyCard } from "@/components/litters/LitterPuppyCard";
import { LitterPuppyKennelRunWorkspace } from "@/components/litters/LitterPuppyKennelRunWorkspace";
import { LitterPuppyNameWorkspace } from "@/components/litters/LitterPuppyNameWorkspace";
import { LitterPuppyRehomeWorkspace } from "@/components/litters/LitterPuppyRehomeWorkspace";
import { LitterPuppySaleWorkspace } from "@/components/litters/LitterPuppySaleWorkspace";

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
    manageablePuppyIds,
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
  litterId,
  puppies,
}: {
  litterId: string;
  puppies: LitterPuppyDto[];
}) {
  const router = useRouter();
  const selectionState = usePuppySelectionState(puppies);
  const selectedPuppyId = [...selectionState.selectedPuppyIds][0] ?? null;
  const selectedPuppy =
    selectionState.selectedCount === 1
      ? puppies.find((puppy) => puppy.dogId === selectedPuppyId) ?? null
      : null;
  const [activeAction, setActiveAction] = useState<"name" | "moveRun" | "sale" | "rehome" | null>(null);

  const onAuthoritativeRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!activeAction || !selectedPuppy) {
      if (!selectedPuppy) setActiveAction(null);
      return;
    }

    const isEligible =
      (activeAction === "name" && selectedPuppy.actionEligibility.canName) ||
      (activeAction === "moveRun" && selectedPuppy.actionEligibility.canMoveRun) ||
      (activeAction === "sale" && selectedPuppy.actionEligibility.canListForSale) ||
      (activeAction === "rehome" && selectedPuppy.actionEligibility.canRehome);
    if (!isEligible) setActiveAction(null);
  }, [activeAction, selectedPuppy]);

  function clearSelection() {
    setActiveAction(null);
    selectionState.clearSelection();
  }

  function selectPuppy(puppyId: string, selected: boolean) {
    if (selected) {
      if (!selectionState.selectedPuppyIds.has(puppyId)) {
        setActiveAction(null);
        selectionState.selectPuppy(puppyId);
      }
      return;
    }

    if (selectionState.selectedPuppyIds.has(puppyId)) {
      setActiveAction(null);
      selectionState.deselectPuppy(puppyId);
    }
  }

  function selectAllManageablePuppies() {
    const alreadySelected =
      selectionState.selectedCount === selectionState.manageablePuppyIds.size &&
      [...selectionState.manageablePuppyIds].every((puppyId) =>
        selectionState.selectedPuppyIds.has(puppyId)
      );

    if (!alreadySelected) {
      setActiveAction(null);
      selectionState.selectAllManageablePuppies();
    }
  }

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-2">
        {puppies.map((puppy) => (
          <LitterPuppyCard
            key={puppy.dogId}
            puppy={puppy}
            isSelected={selectionState.selectedPuppyIds.has(puppy.dogId)}
            onSelectionChange={(selected) => selectPuppy(puppy.dogId, selected)}
          />
        ))}
      </div>

      {selectionState.manageablePuppyIds.size > 0 ? (
        <section className="theme-card mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" aria-live="polite">
          <p className="theme-heading text-sm font-semibold">
            {selectionState.selectedCount.toLocaleString()} {selectionState.selectedCount === 1 ? "puppy" : "puppies"} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAllManageablePuppies}
              className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            >
              Select all eligible
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectionState.selectedCount === 0}
              className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
            >
              Clear selection
            </button>
          </div>
        </section>
      ) : null}

      {selectedPuppy ? (
        <>
          <section className="theme-card mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
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
                onClick={() => setActiveAction("moveRun")}
                disabled={!selectedPuppy.actionEligibility.canMoveRun}
                className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Move Kennel Run
              </button>
              <button
                type="button"
                onClick={() => setActiveAction("sale")}
                disabled={!selectedPuppy.actionEligibility.canListForSale}
                className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Put Up for Sale
              </button>
              <button
                type="button"
                onClick={() => setActiveAction("rehome")}
                disabled={!selectedPuppy.actionEligibility.canRehome}
                className="theme-status-danger rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Re-home
              </button>
            </div>
            {!selectedPuppy.actionEligibility.canName &&
            selectedPuppy.actionEligibility.nameDisabledReason ? (
              <p className="theme-status-danger basis-full rounded-xl px-3 py-2 text-sm">
                {selectedPuppy.actionEligibility.nameDisabledReason}
              </p>
            ) : null}
            {!selectedPuppy.actionEligibility.canMoveRun &&
            selectedPuppy.actionEligibility.moveRunDisabledReason ? (
              <p className="theme-status-danger basis-full rounded-xl px-3 py-2 text-sm">
                {selectedPuppy.actionEligibility.moveRunDisabledReason}
              </p>
            ) : null}
            {!selectedPuppy.actionEligibility.canListForSale &&
            selectedPuppy.actionEligibility.saleDisabledReason ? (
              <p className="theme-status-danger basis-full rounded-xl px-3 py-2 text-sm">
                {selectedPuppy.actionEligibility.saleDisabledReason}
              </p>
            ) : null}
            {!selectedPuppy.actionEligibility.canRehome &&
            selectedPuppy.actionEligibility.rehomeDisabledReason ? (
              <p className="theme-status-danger basis-full rounded-xl px-3 py-2 text-sm">
                {selectedPuppy.actionEligibility.rehomeDisabledReason}
              </p>
            ) : null}
          </section>

          {activeAction === "name" ? (
            <LitterPuppyNameWorkspace
              litterId={litterId}
              puppy={selectedPuppy}
              onClose={() => setActiveAction(null)}
              onAuthoritativeRefresh={onAuthoritativeRefresh}
            />
          ) : null}
          {activeAction === "moveRun" ? (
            <LitterPuppyKennelRunWorkspace
              litterId={litterId}
              puppy={selectedPuppy}
              onClose={() => setActiveAction(null)}
              onAuthoritativeRefresh={onAuthoritativeRefresh}
            />
          ) : null}
          {activeAction === "sale" ? (
            <LitterPuppySaleWorkspace
              litterId={litterId}
              puppy={selectedPuppy}
              onClose={() => setActiveAction(null)}
              onAuthoritativeRefresh={onAuthoritativeRefresh}
            />
          ) : null}
          {activeAction === "rehome" ? (
            <LitterPuppyRehomeWorkspace
              litterId={litterId}
              puppy={selectedPuppy}
              onClose={() => setActiveAction(null)}
              onAuthoritativeRefresh={onAuthoritativeRefresh}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
