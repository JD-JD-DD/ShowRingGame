"use client";

import { useState } from "react";

export function AutomaticStudContractConfirmation(props: {
  studListingId: string;
  sireDogId: string;
  damDogId: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function acceptTerms() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/stud-contracts/automatic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      });
      const data = await response.json();
      setMessage(data?.message ?? data?.error ?? "Unable to accept Stud Contract terms.");
      setAccepted(response.ok && data?.ok);
    } catch {
      setMessage("Unable to accept Stud Contract terms.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="theme-card mt-4 rounded-2xl p-4">
      <h2 className="theme-heading text-lg font-semibold">Automatic Approval</h2>
      <p className="theme-copy mt-2 text-sm">Confirming accepts the current published terms and starts the normal breeding process.</p>
      <button type="button" className="theme-primary-button mt-3 rounded-xl px-4 py-2 text-sm font-semibold" onClick={acceptTerms} disabled={pending || accepted} aria-busy={pending}>
        {pending ? "Accepting Terms…" : accepted ? "Breeding Initiated" : "Accept Terms and Breed"}
      </button>
      {message ? <p className="theme-copy mt-3 text-sm" role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}
