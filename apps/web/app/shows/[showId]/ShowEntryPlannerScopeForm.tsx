"use client";

import { useState } from "react";

import {
  BreedSelectOptions,
  type BreedSelectOption,
} from "@/components/breeds/BreedSelectOptions";

type KennelRunOption = {
  id: string;
  name: string;
  dogCount: number;
};

type ShowEntryPlannerScopeFormProps = {
  showId: string;
  dogIds?: string;
  dogDaySelections?: string;
  breedOptions: Array<BreedSelectOption & { eligibleDogCount: number }>;
  kennelRunOptions: KennelRunOption[];
  selectedBreedCode: string;
  selectedKennelRunId: string;
};

export function shouldPreserveRetrySelections(args: {
  initialBreedCode: string;
  initialKennelRunId: string;
  breedCode: string;
  kennelRunId: string;
}): boolean {
  if (args.breedCode) {
    return (
      Boolean(args.initialBreedCode) &&
      args.breedCode === args.initialBreedCode &&
      !args.kennelRunId
    );
  }

  return (
    Boolean(args.initialKennelRunId) &&
    args.kennelRunId === args.initialKennelRunId
  );
}

export function ShowEntryPlannerScopeForm({
  showId,
  dogIds,
  dogDaySelections,
  breedOptions,
  kennelRunOptions,
  selectedBreedCode,
  selectedKennelRunId,
}: ShowEntryPlannerScopeFormProps) {
  const [breedCode2, setBreedCode2] = useState(selectedBreedCode);
  const [kennelRunId, setKennelRunId] = useState(selectedKennelRunId);
  const preserveRetrySelections = shouldPreserveRetrySelections({
    initialBreedCode: selectedBreedCode,
    initialKennelRunId: selectedKennelRunId,
    breedCode: breedCode2,
    kennelRunId,
  });

  return (
    <form
      action={`/shows/${showId}`}
      method="get"
      className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto]"
    >
      {preserveRetrySelections && dogIds?.trim() ? (
        <input type="hidden" name="dogIds" value={dogIds} />
      ) : null}
      {preserveRetrySelections && dogDaySelections?.trim() ? (
        <input
          type="hidden"
          name="dogDaySelections"
          value={dogDaySelections}
        />
      ) : null}
      <label className="theme-label grid gap-2 text-sm">
        Breed
        <select
          name="breedCode2"
          value={breedCode2}
          onChange={(event) => {
            const nextBreedCode2 = event.target.value;
            setBreedCode2(nextBreedCode2);
            if (nextBreedCode2) {
              setKennelRunId("");
            }
          }}
          className="theme-control rounded-xl px-4 py-3 text-sm font-semibold outline-none"
        >
          <option value="">Choose a breed...</option>
          <BreedSelectOptions
            options={breedOptions}
            getLabel={(breed) => `${breed.name} (${breed.eligibleDogCount})`}
          />
        </select>
      </label>

      <label className="theme-label grid gap-2 text-sm">
        Kennel Run
        <select
          name="kennelRunId"
          value={kennelRunId}
          onChange={(event) => {
            const nextKennelRunId = event.target.value;
            setKennelRunId(nextKennelRunId);
            if (nextKennelRunId) {
              setBreedCode2("");
            }
          }}
          className="theme-control rounded-xl px-4 py-3 text-sm font-semibold outline-none"
        >
          <option value="">Choose a kennel run...</option>
          {kennelRunOptions.map((run) => (
            <option key={run.id} value={run.id}>
              {run.name} ({run.dogCount})
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="theme-primary-button self-end rounded-xl px-5 py-3 text-sm font-semibold"
      >
        Show Dogs
      </button>
    </form>
  );
}
