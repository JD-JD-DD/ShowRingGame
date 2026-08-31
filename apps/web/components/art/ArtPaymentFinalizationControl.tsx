"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ArtPaymentFinalizationControl({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function finalize() {
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/art-payments/${attemptId}/finalize`, { method: "POST" });
      const data = await response.json().catch(() => null) as { state?: string; error?: string } | null;
      if (!response.ok) setMessage(data?.error ?? "Unable to finalize your contribution.");
      else if (data?.state === "COMPLETED") { setMessage("Your contribution is complete."); router.refresh(); }
      else if (data?.state === "UNAVAILABLE") setMessage("This artwork campaign was fully funded before your contribution could be finalized. You were not charged.");
      else if (data?.state === "RECONCILING") setMessage("We’re confirming the payment status with PayPal. Please do not start another contribution for this attempt.");
      else setMessage("Your contribution could not be finalized. You were not charged.");
    } catch { setMessage("Unable to finalize your contribution."); }
    finally { setPending(false); }
  }
  return <div className="mt-5"><button type="button" onClick={finalize} disabled={pending} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">{pending ? "Finalizing…" : "Finalize contribution"}</button>{message ? <p className="theme-copy mt-3 text-sm" role="status" aria-live="polite">{message}</p> : null}</div>;
}
