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
  breedOptions: Array<BreedSelectOption & { eligibleDogCount: number }>;
  kennelRunOptions: KennelRunOption[];
  selectedBreedCode: string;
  selectedKennelRunId: string;
};

export function ShowEntryPlannerScopeForm({
  showId,
  dogIds,
  breedOptions,
  kennelRunOptions,
  selectedBreedCode,
  selectedKennelRunId,
}: ShowEntryPlannerScopeFormProps) {
  const [breedCode2, setBreedCode2] = useState(selectedBreedCode);
  const [kennelRunId, setKennelRunId] = useState(selectedKennelRunId);

  return (
    <form
      action={`/shows/${showId}`}
      method="get"
      className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto]"
    >
      {dogIds?.trim() ? <input type="hidden" name="dogIds" value={dogIds} /> : null}
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
        className="self-end rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
      >
        Show Dogs
      </button>
    </form>
  );
}
