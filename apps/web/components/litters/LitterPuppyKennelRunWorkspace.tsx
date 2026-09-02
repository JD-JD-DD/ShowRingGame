"use client";

import { useEffect, useMemo, useState } from "react";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";

type KennelRunOption = { id: string; name: string; sortOrder: number; isSystem: boolean; kind: "UNCATEGORIZED" | "PLAYER" | "LITTER" };

export type LitterPuppyKennelRunResult = {
  movedCount: number;
  targetRunId: string;
  targetRunName?: string;
  skipped: { dogId: string; reason: string }[];
};

function pluralizePuppies(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "puppy" : "puppies"}`;
}

export function LitterPuppyKennelRunWorkspace({
  litterId,
  eligiblePuppies,
  skippedPuppies,
  onClose,
  onComplete,
}: {
  litterId: string;
  eligiblePuppies: LitterPuppyDto[];
  skippedPuppies: LitterPuppyDto[];
  onClose: () => void;
  onComplete: (result: LitterPuppyKennelRunResult) => void;
}) {
  const [runs, setRuns] = useState<KennelRunOption[]>([]);
  const [targetRunId, setTargetRunId] = useState("");
  const [isLoading, setIsLoading] = useState(eligiblePuppies.length > 0);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRun = useMemo(() => runs.find((run) => run.id === targetRunId) ?? null, [runs, targetRunId]);
  const alreadyThere = useMemo(
    () => targetRunId ? eligiblePuppies.filter((puppy) => puppy.kennelRun?.runId === targetRunId) : [],
    [eligiblePuppies, targetRunId]
  );
  const puppiesToMove = useMemo(
    () => targetRunId ? eligiblePuppies.filter((puppy) => puppy.kennelRun?.runId !== targetRunId) : eligiblePuppies,
    [eligiblePuppies, targetRunId]
  );

  useEffect(() => {
    if (eligiblePuppies.length === 0) return;
    let isMounted = true;
    async function loadRuns() {
      try {
        const response = await fetch("/api/kennel/runs", { headers: { Accept: "application/json" } });
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; runs?: KennelRunOption[]; error?: string };
        if (!response.ok || data.ok === false) throw new Error(data.error ?? "Failed to load Kennel Runs.");
        if (isMounted) setRuns(Array.isArray(data.runs) ? data.runs : []);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "Failed to load Kennel Runs.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void loadRuns();
    return () => { isMounted = false; };
  }, [eligiblePuppies.length]);

  async function movePuppies(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetRunId || puppiesToMove.length === 0 || isMoving) return;
    setIsMoving(true);
    setError(null);
    try {
      const response = await fetch(`/api/litters/${litterId}/puppies/bulk-kennel-run`, {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ dogIds: eligiblePuppies.map((puppy) => puppy.dogId), targetRunId }),
      });
      const data = (await response.json().catch(() => ({}))) as LitterPuppyKennelRunResult & { error?: string; ok?: boolean };
      if (!response.ok || data.ok === false) {
        setError(data.error ?? "Failed to move puppies.");
        return;
      }
      onComplete({ ...data, targetRunName: selectedRun?.name });
    } catch {
      setError("Failed to move puppies.");
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <section className="theme-card mt-5 rounded-2xl p-5" aria-labelledby="move-puppy-heading">
      <h3 id="move-puppy-heading" className="theme-heading text-lg font-semibold">Move Kennel Run</h3>
      {eligiblePuppies.length === 0 ? (
        <div className="mt-5 grid gap-3"><p className="theme-copy rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">No selected puppies can be moved.</p><div><button type="button" onClick={onClose} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Close</button></div></div>
      ) : (
        <form onSubmit={movePuppies} className="mt-5 grid max-w-xl gap-4">
          <label className="grid gap-2 text-sm font-semibold" htmlFor="litter-puppy-destination-run">Destination kennel run
            <select id="litter-puppy-destination-run" value={targetRunId} onChange={(event) => { setTargetRunId(event.target.value); setError(null); }} disabled={isLoading || isMoving || runs.length === 0} className="dog-control rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">
              <option value="">{isLoading ? "Loading Kennel Runs..." : "Choose Kennel Run..."}</option>
              {runs.map((run) => <option key={run.id} value={run.id}>{run.name}</option>)}
            </select>
          </label>
          {isLoading ? <p className="theme-copy text-sm" role="status">Loading Kennel Runs...</p> : null}
          {!isLoading && !error && runs.length === 0 ? <p className="theme-copy text-sm">No kennel runs are available.</p> : null}
          {selectedRun ? (
            <div className="theme-copy grid gap-1 text-sm"><p>{pluralizePuppies(eligiblePuppies.length + skippedPuppies.length)} selected</p><p>{pluralizePuppies(puppiesToMove.length)} will be moved to <span className="font-semibold">{selectedRun.name}</span></p><p>{pluralizePuppies(skippedPuppies.length + alreadyThere.length)} will be skipped</p>{alreadyThere.length > 0 ? <ul className="mt-2 grid gap-1">{alreadyThere.map((puppy) => <li key={puppy.dogId}>{puppy.displayName} · {puppy.regNumber}: Already in {selectedRun.name}.</li>)}</ul> : null}</div>
          ) : null}
          {error ? <p className="theme-status-danger rounded-xl px-3 py-2 text-sm" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={!selectedRun || puppiesToMove.length === 0 || isLoading || isMoving} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">{isMoving ? "Moving..." : "Confirm Move"}</button><button type="button" disabled={isMoving} onClick={onClose} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Cancel</button></div>
        </form>
      )}
    </section>
  );
}
