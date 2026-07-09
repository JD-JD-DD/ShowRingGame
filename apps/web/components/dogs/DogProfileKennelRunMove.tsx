"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

type KennelRunOption = {
  id: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
  dogCount?: number;
};

type Props = {
  dogId: string;
  currentRunId: string | null;
  currentRunName: string | null;
  canMove: boolean;
  children?: ReactNode;
};

export default function DogProfileKennelRunMove({
  dogId,
  currentRunId,
  currentRunName,
  canMove,
  children,
}: Props) {
  const [runs, setRuns] = useState<KennelRunOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [displayRunId, setDisplayRunId] = useState(currentRunId);
  const [displayRunName, setDisplayRunName] = useState(currentRunName);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!canMove || !isOpen) return;

    let isMounted = true;

    async function loadRuns() {
      setIsLoadingRuns(true);
      setError(null);

      try {
        const response = await fetch("/api/kennel/runs", {
          headers: { Accept: "application/json" },
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.ok === false) {
          throw new Error(data.error || "Failed to load Kennel Runs.");
        }

        if (isMounted) {
          setRuns(Array.isArray(data.runs) ? data.runs : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load Kennel Runs."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRuns(false);
        }
      }
    }

    void loadRuns();

    return () => {
      isMounted = false;
    };
  }, [canMove, isOpen]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  function closePanel() {
    setIsOpen(false);
    setSelectedRunId("");
    setMessage(null);
    setError(null);
  }

  function togglePanel() {
    if (!canMove) return;

    if (isOpen) {
      closePanel();
      return;
    }

    setIsOpen(true);
    setMessage(null);
    setError(null);
  }

  async function handleMove() {
    if (!selectedRunId || isMoving) return;

    setIsMoving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/kennel/dogs/run", {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dogIds: [dogId],
          targetRunId: selectedRunId,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Failed to move dog.");
      }

      const runName = selectedRun?.name ?? "the selected Kennel Run";
      setDisplayRunId(selectedRunId);
      setDisplayRunName(runName);
      setSelectedRunId("");
      setMessage(`Moved to ${runName}.`);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move dog.");
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={togglePanel}
        disabled={!canMove || isMoving}
        aria-expanded={isOpen}
        className="dog-secondary-button rounded-2xl px-5 py-3 text-center text-sm font-semibold transition hover:bg-purple-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Move Run
      </button>

      {children}

      {isOpen ? (
        <section className="dog-card rounded-2xl p-4 sm:col-span-2">
          <div className="flex flex-col gap-3">
            <div className="dog-copy text-sm">
              Current Run:{" "}
              <span className="font-semibold text-[var(--dog-heading)]">
                {displayRunName ?? (displayRunId ? "Unknown" : "Unassigned")}
              </span>
            </div>

            <label className="sr-only" htmlFor="dog-profile-move-run">
              Move to Run
            </label>
            <select
              id="dog-profile-move-run"
              value={selectedRunId}
              onChange={(event) => {
                setSelectedRunId(event.target.value);
                setMessage(null);
                setError(null);
              }}
              disabled={isLoadingRuns || isMoving || runs.length === 0}
              className="rounded-xl border border-[var(--dog-border)] bg-slate-950/60 px-3 py-2 text-sm text-[var(--dog-heading)] outline-none transition focus:border-purple-300/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {isLoadingRuns
                  ? "Loading Kennel Runs..."
                  : "Choose Kennel Run..."}
              </option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.name}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={closePanel}
                disabled={isMoving}
                className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMove}
                disabled={!selectedRunId || isMoving}
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMoving ? "Moving..." : "Move Dog"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 sm:col-span-2">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm text-red-100 sm:col-span-2">
          {error}
        </div>
      ) : null}
    </>
  );
}
