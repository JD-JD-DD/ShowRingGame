"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const autoFinalizationStartedAttemptIds = new Set<string>();

export default function ArtPaymentFinalizationControl({ attemptId, recheckOnly = false, autoFinalize = false }: { attemptId: string; recheckOnly?: boolean; autoFinalize?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [showStatusCheck, setShowStatusCheck] = useState(recheckOnly);
  const autoFinalizing = useRef(false);
  const finalize = useCallback(async () => {
    setPending(true); setMessage("");
    try {
      const response = await fetch(`/api/art-payments/${attemptId}/finalize`, { method: "POST" });
      const data = await response.json().catch(() => null) as { state?: string; error?: string } | null;
      if (!response.ok) setMessage(data?.error ?? "Unable to finalize your contribution.");
      else if (data?.state === "COMPLETED") { setMessage("Your contribution is complete."); router.refresh(); }
      else if (data?.state === "UNAVAILABLE") { setMessage("This artwork campaign was fully funded before your contribution could be finalized. You were not charged."); router.refresh(); }
      else if (data?.state === "FAILED") { setMessage("PayPal could not complete this contribution. No contribution was completed."); router.refresh(); }
      else if (data?.state === "RECONCILING") { setMessage("We’re confirming the payment status with PayPal. Please do not start another contribution for this attempt."); setShowStatusCheck(true); }
      else setMessage("Your contribution could not be finalized. Please check the contribution status again.");
    } catch { setMessage("Unable to finalize your contribution."); }
    finally { setPending(false); }
  }, [attemptId, router]);

  useEffect(() => {
    if (!autoFinalize || autoFinalizing.current || autoFinalizationStartedAttemptIds.has(attemptId)) return;
    autoFinalizing.current = true;
    autoFinalizationStartedAttemptIds.add(attemptId);
    void finalize();
  }, [attemptId, autoFinalize, finalize]);

  if (autoFinalize && !showStatusCheck) return <div className="mt-5"><p className="theme-copy text-sm" role="status" aria-live="polite">{message || "Finalizing your contribution…"}</p></div>;
  return <div className="mt-5"><button type="button" onClick={finalize} disabled={pending} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">{pending ? "Checking…" : showStatusCheck ? "Check contribution status" : "Finalize contribution"}</button>{message ? <p className="theme-copy mt-3 text-sm" role="status" aria-live="polite">{message}</p> : null}</div>;
}
