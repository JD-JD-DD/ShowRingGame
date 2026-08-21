"use client";

import { useState } from "react";

export function ManualStudContractRequest(props: {
  studListingId: string;
  sireDogId: string;
  damDogId: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  async function requestApproval() {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/stud-contracts/manual", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      });
      const data = await response.json();
      setMessage(data?.message ?? data?.error ?? "Unable to request Stud Approval.");
      setSubmitted(response.ok && data?.ok);
    } catch {
      setMessage("Unable to request Stud Approval.");
    } finally { setPending(false); }
  }
  return <section className="theme-card mt-4 rounded-2xl p-4">
    <h2 className="theme-heading text-lg font-semibold">Manual Approval</h2>
    <p className="theme-copy mt-2 text-sm">Owner approval is required. The request remains open for 24 real hours, does not reserve the sire, and charges no fee unless approval and breeding later succeed.</p>
    <button type="button" className="theme-primary-button mt-3 rounded-xl px-4 py-2 text-sm font-semibold" onClick={requestApproval} disabled={pending || submitted} aria-busy={pending}>{pending ? "Requesting…" : submitted ? "Stud approval pending" : "Request Stud Approval"}</button>
    {message ? <p className="theme-copy mt-3 text-sm" role="status" aria-live="polite">{message}</p> : null}
  </section>;
}
