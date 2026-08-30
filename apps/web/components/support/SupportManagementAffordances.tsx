"use client";

import { useState } from "react";
import { getSupportTierPresentation, type SupportPresentationTierValue } from "@/lib/supportPresentation";

const changes: Record<SupportPresentationTierValue, SupportPresentationTierValue[]> = { BRONZE: ["SILVER", "GOLD"], SILVER: ["GOLD", "BRONZE"], GOLD: ["SILVER", "BRONZE"] };

export default function SupportManagementAffordances({ currentTier, paidThrough }: { currentTier: SupportPresentationTierValue; paidThrough: Date | null }) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<SupportPresentationTierValue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const choices = changes[currentTier];
  const isDowngrade = tier !== null && ({ BRONZE: 0, SILVER: 1, GOLD: 2 }[tier] < { BRONZE: 0, SILVER: 1, GOLD: 2 }[currentTier]);

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

  async function cancelSupport() {
    if (submitting) return;
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/support/cancel", { method: "POST" });
      const data: any = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Unable to cancel your support right now."); setSubmitting(false); return; }
      window.location.reload();
    } catch { setError("Unable to cancel your support right now."); setSubmitting(false); }
  }

  return <section aria-label="Support management" className="mt-6">
    <div className="flex flex-wrap gap-3"><button type="button" onClick={() => { setOpen(true); setTier(null); setError(""); }} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Change support level</button><button type="button" onClick={() => { setConfirmCancel(true); setError(""); }} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Cancel Support</button></div>
    {open ? <section role="dialog" aria-modal="true" aria-labelledby="upgrade-support-heading" className="theme-panel mt-4 rounded-xl p-4">
      <h2 id="upgrade-support-heading" className="theme-heading font-semibold">Change support level</h2>
      <p className="theme-copy mt-2 text-sm">{isDowngrade ? "Your current support level will remain active until PayPal applies the lower level at your next billing cycle. You will continue to see your current supporter badge until the change takes effect. Payments already made for the current support period are not prorated or refunded." : "Upgrading starts a new higher-level monthly support subscription. Your current support remains active until PayPal approves the new level. Once the new level is active, your previous subscription will be cancelled. Payments already made for your current support period are not prorated or refunded."}</p>
      <div className="mt-4 flex flex-wrap gap-3">{choices.map((choice) => <button key={choice} type="button" onClick={() => setTier(choice)} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">{getSupportTierPresentation(choice).label}</button>)}</div>
      {tier ? <p className="theme-copy mt-4 text-sm">Selected: {getSupportTierPresentation(tier).label}.</p> : null}
      {error ? <p role="alert" className="theme-status-danger mt-4 rounded-xl px-3 py-2 text-sm">{error}</p> : null}
      <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => setOpen(false)} disabled={submitting} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={continueToPayPal} disabled={!tier || submitting} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Starting upgrade..." : "Continue to PayPal"}</button></div>
    </section> : null}
    {confirmCancel ? <section role="dialog" aria-modal="true" aria-labelledby="cancel-support-heading" className="theme-panel mt-4 rounded-xl p-4"><h2 id="cancel-support-heading" className="theme-heading font-semibold">Cancel {getSupportTierPresentation(currentTier).label}?</h2><p className="theme-copy mt-2 text-sm">Your recurring PayPal subscription will be cancelled. Your {getSupportTierPresentation(currentTier).label} recognition will remain active through {paidThrough ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(paidThrough) : "your verified paid support period"}. Payments already made are not prorated or refunded.</p>{error ? <p role="alert" className="theme-status-danger mt-4 rounded-xl px-3 py-2 text-sm">{error}</p> : null}<div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => setConfirmCancel(false)} disabled={submitting} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Keep Support</button><button type="button" onClick={cancelSupport} disabled={submitting} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold">{submitting ? "Cancelling support..." : "Cancel Support"}</button></div></section> : null}
  </section>;
}
