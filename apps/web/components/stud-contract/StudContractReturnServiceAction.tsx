"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StudContractReturnServiceAction(props: { returnServiceId: string; expiresAt: string; canAttempt?: boolean; unavailableReason?: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const expiresAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(props.expiresAt));
  async function attempt() {
    if (pending) return;
    setPending(true); setFeedback(null);
    try {
      const response = await fetch(`/api/stud-contract-return-services/${encodeURIComponent(props.returnServiceId)}/attempt`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setFeedback({ kind: "error", message: typeof payload.error === "string" ? payload.error : "Unable to attempt Return Service. Please try again." });
        return;
      }
      setFeedback({ kind: "success", message: "Return Service used. The return breeding has begun." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Unable to attempt Return Service. Please try again." });
    } finally { setPending(false); }
  }
  const canAttempt = props.canAttempt ?? true;
  const disabled = pending || !canAttempt;
  return <div className="mt-4 border-t border-white/10 pt-4"><p className="theme-copy text-sm">Available until {expiresAt} (real time). The same sire and dam under the original contracting kennels are required. This does not reserve the sire or bypass Stud Recovery/current eligibility, and temporary unavailability does not extend the deadline. One successful return breeding consumes this service; original stud compensation is not charged again, though normal breeding costs still apply.</p><button type="button" onClick={attempt} disabled={disabled} aria-describedby={!canAttempt && props.unavailableReason ? `return-service-reason-${props.returnServiceId}` : undefined} className="theme-primary-button mt-4 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Attempting Return Service…" : "Attempt Return Service"}</button>{!canAttempt && props.unavailableReason ? <p id={`return-service-reason-${props.returnServiceId}`} className="theme-status-danger mt-3 rounded-xl p-3 text-sm" role="status">{props.unavailableReason}</p> : null}{feedback ? <p className={`mt-3 rounded-xl p-3 text-sm ${feedback.kind === "success" ? "theme-status-info" : "theme-status-danger"}`} role="status" aria-live="polite">{feedback.message}</p> : null}</div>;
}
