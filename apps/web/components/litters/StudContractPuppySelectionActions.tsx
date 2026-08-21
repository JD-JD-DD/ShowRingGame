"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StudContractPuppySelectionActions(props: { selectionId: string; action: "DAM_PROTECTED_PICK" | "STUD_PICK"; puppies: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  async function selectPuppy(puppyId: string) {
    if (!window.confirm("Record this contractual puppy selection? The game will not automatically replace it later.")) return;
    setPendingId(puppyId); setError(null);
    try {
      const response = await fetch("/api/stud-contract-puppy-selection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectionId: props.selectionId, puppyId, action: props.action }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Puppy selection could not be recorded.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Puppy selection could not be recorded."); }
    finally { setPendingId(null); }
  }
  return <div className="mt-4 grid gap-2"><p className="theme-copy text-sm">The game will not choose a puppy automatically.</p>{props.puppies.map((puppy) => <button key={puppy.id} type="button" onClick={() => selectPuppy(puppy.id)} disabled={pendingId !== null} className="theme-primary-button rounded-xl px-3 py-2 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">{pendingId === puppy.id ? "Recording selection..." : `${props.action === "DAM_PROTECTED_PICK" ? "Choose Protected Puppy" : "Select Puppy"}: ${puppy.label}`}</button>)}{error ? <p role="alert" className="theme-status-danger rounded-xl px-3 py-2 text-sm">{error}</p> : null}</div>;
}
