"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type StudContractSelectionPuppy = {
  id: string;
  displayName: string;
  regNumber: string;
  sex: string;
  litterOrder: number | null;
  canPick: boolean;
  disabledReason: string | null;
};

export function StudContractPuppySelectionActions(props: {
  selectionId: string;
  action: "DAM_PROTECTED_PICK" | "STUD_PICK";
  puppies: StudContractSelectionPuppy[];
}) {
  const router = useRouter();
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectionRecorded, setSelectionRecorded] = useState(false);

  async function selectPuppy(puppyId: string) {
    if (submittingRef.current || selectionRecorded) return;
    if (!window.confirm("Record this contractual puppy selection? The game will not automatically replace it later.")) return;

    submittingRef.current = true;
    setPendingId(puppyId);
    setError(null);
    try {
      const response = await fetch("/api/stud-contract-puppy-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectionId: props.selectionId, puppyId, action: props.action }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Puppy selection could not be recorded.");
      }
      setSelectionRecorded(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Puppy selection could not be recorded.");
    } finally {
      submittingRef.current = false;
      setPendingId(null);
    }
  }

  return (
    <div className="mt-4 grid gap-3" aria-live="polite">
      <p className="theme-copy text-sm">The game will not choose a puppy automatically.</p>
      {props.puppies.map((puppy) => {
        const disabled = !puppy.canPick || pendingId !== null || selectionRecorded;
        const disabledReason = selectionRecorded
          ? "A selection was recorded. Refreshing the authoritative contract state."
          : puppy.disabledReason;
        return (
          <article key={puppy.id} className="theme-card rounded-xl p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => selectPuppy(puppy.id)}
                  disabled={disabled}
                  aria-describedby={disabledReason ? `selection-reason-${puppy.id}` : undefined}
                  className="theme-primary-button min-w-28 rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
                >
                  {pendingId === puppy.id ? "Picking..." : "Pick Puppy"}
                </button>
              </div>
              <div className="min-w-0">
                <div className="theme-label text-xs uppercase tracking-wide">
                  Puppy {puppy.litterOrder ?? "-"} / {puppy.sex}
                </div>
                <Link
                  href={`/dogs/${puppy.id}`}
                  className="theme-heading mt-1 block truncate text-lg font-semibold hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
                >
                  {puppy.displayName}
                </Link>
                <p className="theme-copy mt-1 text-sm">{puppy.regNumber}</p>
                {disabledReason ? <p id={`selection-reason-${puppy.id}`} className="theme-copy mt-2 text-sm">{disabledReason}</p> : null}
              </div>
            </div>
          </article>
        );
      })}
      {error ? <p role="alert" className="theme-status-danger rounded-xl px-3 py-2 text-sm">{error}</p> : null}
    </div>
  );
}
