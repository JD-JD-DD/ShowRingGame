"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";
import { LitterPuppyCard } from "@/components/litters/LitterPuppyCard";
import { LitterPuppyKennelRunWorkspace } from "@/components/litters/LitterPuppyKennelRunWorkspace";
import { LitterPuppyNameWorkspace } from "@/components/litters/LitterPuppyNameWorkspace";
import type { LitterPuppyNamingResult } from "@/components/litters/LitterPuppyNameWorkspace";
import { LitterPuppyRehomeWorkspace } from "@/components/litters/LitterPuppyRehomeWorkspace";
import { LitterPuppySaleWorkspace } from "@/components/litters/LitterPuppySaleWorkspace";

type PuppySelectionItem = Pick<
  LitterPuppyDto,
  "dogId" | "isManageableByBreeder"
>;

type PuppyActionKey = "name" | "moveRun" | "sale" | "rehome";

const PUPPY_ACTIONS: Record<
  PuppyActionKey,
  {
    label: string;
    eligibleLabel: string;
    isEligible: (puppy: LitterPuppyDto) => boolean;
    disabledReason: (puppy: LitterPuppyDto) => string | null;
  }
> = {
  name: {
    label: "Name",
    eligibleLabel: "can be named",
    isEligible: (puppy) => puppy.actionEligibility.canName,
    disabledReason: (puppy) => puppy.actionEligibility.nameDisabledReason,
  },
  moveRun: {
    label: "Move Kennel Run",
    eligibleLabel: "can be moved",
    isEligible: (puppy) => puppy.actionEligibility.canMoveRun,
    disabledReason: (puppy) => puppy.actionEligibility.moveRunDisabledReason,
  },
  sale: {
    label: "Put Up for Sale",
    eligibleLabel: "will be listed for sale",
    isEligible: (puppy) => puppy.actionEligibility.canListForSale,
    disabledReason: (puppy) => puppy.actionEligibility.saleDisabledReason,
  },
  rehome: {
    label: "Re-home",
    eligibleLabel: "can be re-homed",
    isEligible: (puppy) => puppy.actionEligibility.canRehome,
    disabledReason: (puppy) => puppy.actionEligibility.rehomeDisabledReason,
  },
};

function pluralizePuppies(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "puppy" : "puppies"}`;
}

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
  const selectedPuppies = useMemo(
    () =>
      puppies.filter((puppy) =>
        selectionState.selectedPuppyIds.has(puppy.dogId)
      ),
    [puppies, selectionState.selectedPuppyIds]
  );
  const [activeAction, setActiveAction] = useState<"name" | "moveRun" | "sale" | "rehome" | null>(null);
  const [namingResult, setNamingResult] = useState<LitterPuppyNamingResult | null>(null);
  const activeActionDescriptor = activeAction ? PUPPY_ACTIONS[activeAction] : null;
  const activeActionPartition = activeActionDescriptor
    ? {
        eligiblePuppies: selectedPuppies.filter(activeActionDescriptor.isEligible),
        skippedPuppies: selectedPuppies.filter(
          (puppy) => !activeActionDescriptor.isEligible(puppy)
        ),
      }
    : null;
  const singleEligiblePuppy =
    selectedPuppies.length === 1 && activeActionPartition?.eligiblePuppies.length === 1
      ? activeActionPartition.eligiblePuppies[0]
      : null;

  const onAuthoritativeRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (selectedPuppies.length === 0) setActiveAction(null);
  }, [selectedPuppies]);

  function clearSelection() {
    setActiveAction(null);
    setNamingResult(null);
    selectionState.clearSelection();
  }

  function selectPuppy(puppyId: string, selected: boolean) {
    if (selected) {
      if (!selectionState.selectedPuppyIds.has(puppyId)) {
        setActiveAction(null);
        setNamingResult(null);
        selectionState.selectPuppy(puppyId);
      }
      return;
    }

    if (selectionState.selectedPuppyIds.has(puppyId)) {
      setActiveAction(null);
      setNamingResult(null);
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
      setNamingResult(null);
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
            {pluralizePuppies(selectionState.selectedCount)} selected
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

      {selectedPuppies.length > 0 ? (
        <>
          {namingResult ? (
            <section className="theme-status-success mt-5 rounded-xl px-4 py-3 text-sm" role="status">
              <p className="font-semibold">Names updated</p>
              <p>{pluralizePuppies(namingResult.updatedCount)} updated.{namingResult.skipped.length > 0 ? ` ${pluralizePuppies(namingResult.skipped.length)} skipped.` : ""}</p>
              {namingResult.skipped.length > 0 ? (
                <ul className="mt-2 grid gap-1">
                  {namingResult.skipped.map((skipped) => {
                    const puppy = puppies.find((candidate) => candidate.dogId === skipped.dogId);
                    return <li key={skipped.dogId}>{puppy ? `${puppy.displayName} · ${puppy.regNumber}` : "Puppy"}: {skipped.reason}</li>;
                  })}
                </ul>
              ) : null}
            </section>
          ) : null}
          <section className="theme-card mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveAction("name")}
                className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Name
              </button>
              <button
                type="button"
                onClick={() => setActiveAction("moveRun")}
                className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Move Kennel Run
              </button>
              <button
                type="button"
                onClick={() => setActiveAction("sale")}
                className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Put Up for Sale
              </button>
              <button
                type="button"
                onClick={() => setActiveAction("rehome")}
                className="theme-status-danger rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                Re-home
              </button>
            </div>
          </section>

          {activeActionDescriptor && activeActionPartition ? (
            <section className="theme-card mt-5 rounded-2xl p-5" aria-labelledby="litter-puppy-action-review-heading">
              <h3 id="litter-puppy-action-review-heading" className="theme-heading text-lg font-semibold">
                {activeActionDescriptor.label}
              </h3>
              <p className="theme-copy mt-1 text-sm">
                {pluralizePuppies(selectedPuppies.length)} selected
              </p>
              <div className="theme-copy mt-4 grid gap-1 text-sm">
                <p>{pluralizePuppies(activeActionPartition.eligiblePuppies.length)} {activeActionDescriptor.eligibleLabel}</p>
                <p>{pluralizePuppies(activeActionPartition.skippedPuppies.length)} will be skipped</p>
              </div>
              {activeActionPartition.skippedPuppies.length > 0 ? (
                <div className="mt-4">
                  <h4 className="theme-heading text-sm font-semibold">Skipped</h4>
                  <ul className="theme-copy mt-2 grid gap-2 text-sm">
                    {activeActionPartition.skippedPuppies.map((puppy) => (
                      <li key={puppy.dogId} className="rounded-xl border border-[var(--color-border)] px-3 py-2">
                        <span className="font-semibold">{puppy.displayName}</span> · {puppy.regNumber}
                        <span className="block mt-1">{activeActionDescriptor.disabledReason(puppy) || "This action is not currently available for this puppy."}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activeActionPartition.eligiblePuppies.length === 0 ? (
                <p className="theme-status-danger mt-4 rounded-xl px-3 py-2 text-sm">
                  No selected puppies can proceed with this action.
                </p>
              ) : null}
            </section>
          ) : null}

          {activeAction === "name" && activeActionPartition ? (
            <LitterPuppyNameWorkspace
              litterId={litterId}
              eligiblePuppies={activeActionPartition.eligiblePuppies}
              skippedPuppies={activeActionPartition.skippedPuppies}
              onClose={() => setActiveAction(null)}
              onComplete={(result) => {
                setActiveAction(null);
                setNamingResult(result);
                onAuthoritativeRefresh();
              }}
            />
          ) : null}
          {activeAction === "moveRun" && singleEligiblePuppy ? (
            <LitterPuppyKennelRunWorkspace
              litterId={litterId}
              puppy={singleEligiblePuppy}
              onClose={() => setActiveAction(null)}
              onAuthoritativeRefresh={onAuthoritativeRefresh}
            />
          ) : null}
          {activeAction === "sale" && singleEligiblePuppy ? (
            <LitterPuppySaleWorkspace
              litterId={litterId}
              puppy={singleEligiblePuppy}
              onClose={() => setActiveAction(null)}
              onAuthoritativeRefresh={onAuthoritativeRefresh}
            />
          ) : null}
          {activeAction === "rehome" && singleEligiblePuppy ? (
            <LitterPuppyRehomeWorkspace
              litterId={litterId}
              puppy={singleEligiblePuppy}
              onClose={() => setActiveAction(null)}
              onAuthoritativeRefresh={onAuthoritativeRefresh}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
