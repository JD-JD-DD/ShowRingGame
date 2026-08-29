"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReconcileSupportStatusButton() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState("");

  async function reconcile() {
    if (isChecking) return;
    setIsChecking(true);
    setMessage("");
    try {
      const response = await fetch("/api/support/reconcile", { method: "POST" });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage("Your support status could not be verified with PayPal right now. No support data was changed.");
        return;
      }
      const status = data !== null && typeof data === "object" && "subscription" in data &&
        data.subscription !== null && typeof data.subscription === "object" && "status" in data.subscription &&
        typeof data.subscription.status === "string" ? data.subscription.status : null;
      setMessage(status === "PENDING" ? "PayPal has not activated this subscription yet." : "Your support status has been updated from PayPal.");
      router.refresh();
    } catch {
      setMessage("Your support status could not be verified with PayPal right now. No support data was changed.");
    } finally {
      setIsChecking(false);
    }
  }

  return <div className="mt-5">
    <p className="theme-copy mb-3 text-sm">Your PayPal approval may still be synchronizing. You can check PayPal for the latest verified support status.</p>
    <button type="button" onClick={reconcile} disabled={isChecking} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
      {isChecking ? "Checking PayPal Status…" : "Refresh from PayPal"}
    </button>
    {message ? <p role="status" className="theme-status-info mt-3 rounded-xl px-3 py-2 text-sm">{message}</p> : null}
  </div>;
}
