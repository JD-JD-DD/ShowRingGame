"use client";

import { useState } from "react";
import { getSupportTierPresentation, type SupportPresentationTierValue } from "@/lib/supportPresentation";

const upgrades: Record<SupportPresentationTierValue, SupportPresentationTierValue[]> = { BRONZE: ["SILVER", "GOLD"], SILVER: ["GOLD"], GOLD: [] };

export default function SupportManagementAffordances({ currentTier }: { currentTier: SupportPresentationTierValue }) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<SupportPresentationTierValue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const choices = upgrades[currentTier];

  async function continueToPayPal() {
    if (!tier || submitting) return;
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/support/change-tier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier }) });
      const data: any = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Unable to change your support level right now."); setSubmitting(false); return; }
      if (typeof data?.change?.approvalUrl === "string") { window.location.assign(data.change.approvalUrl); return; }
      setError("Your support-level change is already awaiting PayPal approval. Return to PayPal to complete it."); setSubmitting(false);
    } catch { setError("Unable to change your support level right now."); setSubmitting(false); }
  }

  if (!choices.length) return null;
  return <section aria-label="Support management" className="mt-6">
    <button type="button" onClick={() => { setOpen(true); setTier(null); setError(""); }} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Change support level</button>
    {open ? <section role="dialog" aria-modal="true" aria-labelledby="upgrade-support-heading" className="theme-panel mt-4 rounded-xl p-4">
      <h2 id="upgrade-support-heading" className="theme-heading font-semibold">Upgrade support level</h2>
      <p className="theme-copy mt-2 text-sm">Upgrading starts a new higher-level monthly support subscription. Your current support remains active until PayPal approves the new level. Once the new level is active, your previous subscription will be cancelled. Payments already made for your current support period are not prorated or refunded.</p>
      <div className="mt-4 flex flex-wrap gap-3">{choices.map((choice) => <button key={choice} type="button" onClick={() => setTier(choice)} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">{getSupportTierPresentation(choice).label}</button>)}</div>
      {tier ? <p className="theme-copy mt-4 text-sm">Selected: {getSupportTierPresentation(tier).label}.</p> : null}
      {error ? <p role="alert" className="theme-status-danger mt-4 rounded-xl px-3 py-2 text-sm">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => setOpen(false)} disabled={submitting} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={continueToPayPal} disabled={!tier || submitting} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Starting upgrade..." : "Continue to PayPal"}</button></div>
    </section> : null}
  </section>;
}
