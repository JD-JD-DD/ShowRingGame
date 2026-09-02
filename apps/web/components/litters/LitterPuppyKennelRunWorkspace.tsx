"use client";

import { useEffect, useMemo, useState } from "react";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";

type KennelRunOption = {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  kind: "UNCATEGORIZED" | "PLAYER" | "LITTER";
};

export function LitterPuppyKennelRunWorkspace({
  litterId,
  puppy,
  onClose,
  onAuthoritativeRefresh,
}: {
  litterId: string;
  puppy: LitterPuppyDto;
  onClose: () => void;
  onAuthoritativeRefresh: () => void;
}) {
  const [runs, setRuns] = useState<KennelRunOption[]>([]);
  const [targetRunId, setTargetRunId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRun = useMemo(
    () => runs.find((run) => run.id === targetRunId) ?? null,
    [runs, targetRunId]
  );
  const isCurrentRun = targetRunId !== "" && targetRunId === puppy.kennelRun?.runId;

  useEffect(() => {
    let isMounted = true;

    async function loadRuns() {
      try {
        const response = await fetch("/api/kennel/runs", {
          headers: { Accept: "application/json" },
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          runs?: KennelRunOption[];
          error?: string;
        };
        if (!response.ok || data.ok === false) {
          throw new Error(data.error ?? "Failed to load Kennel Runs.");
        }
        if (isMounted) setRuns(Array.isArray(data.runs) ? data.runs : []);
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load Kennel Runs."
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadRuns();
    return () => {
      isMounted = false;
    };
  }, []);

  async function movePuppy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetRunId || isCurrentRun || isMoving) return;

    setIsMoving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/litters/${litterId}/puppies/${puppy.dogId}/kennel-run`,
        {
          method: "PATCH",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ targetRunId }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!response.ok || data.ok === false) {
        setError(data.error ?? "Failed to move puppy.");
        if (response.status === 403 || response.status === 404) onAuthoritativeRefresh();
        return;
      }

      onClose();
      onAuthoritativeRefresh();
    } catch {
      setError("Failed to move puppy.");
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <section className="theme-card mt-5 rounded-2xl p-5" aria-labelledby="move-puppy-heading">
      <h3 id="move-puppy-heading" className="theme-heading text-lg font-semibold">
        Move Kennel Run
      </h3>
      <p className="theme-copy mt-1 text-sm">{puppy.displayName} · {puppy.regNumber}</p>
      <p className="theme-copy mt-2 text-sm">
        Current kennel run: <span className="font-semibold">{puppy.kennelRun?.name ?? "Unassigned"}</span>
      </p>

      <form onSubmit={movePuppy} className="mt-5 grid max-w-xl gap-4">
        <label className="grid gap-2 text-sm font-semibold" htmlFor="litter-puppy-destination-run">
          Destination kennel run
          <select
            id="litter-puppy-destination-run"
            value={targetRunId}
            onChange={(event) => {
              setTargetRunId(event.target.value);
              setError(null);
            }}
            disabled={isLoading || isMoving || runs.length === 0}
            className="dog-control rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          >
            <option value="">{isLoading ? "Loading Kennel Runs..." : "Choose Kennel Run..."}</option>
            {runs.map((run) => <option key={run.id} value={run.id}>{run.name}</option>)}
          </select>
        </label>

        {isLoading ? <p className="theme-copy text-sm" role="status">Loading Kennel Runs...</p> : null}
        {!isLoading && !error && runs.length === 0 ? <p className="theme-copy text-sm">No kennel runs are available.</p> : null}
        {isCurrentRun ? <p className="theme-copy text-sm">This puppy is already in this kennel run.</p> : null}
        {error ? <p className="theme-status-danger rounded-xl px-3 py-2 text-sm" role="alert">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={!selectedRun || isCurrentRun || isLoading || isMoving} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">
            {isMoving ? "Moving..." : "Move Puppy"}
          </button>
          <button type="button" disabled={isMoving} onClick={onClose} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
