"use client";

import { useState } from "react";

type Props = { kennelName: string; kennelSlug: string; initialPending: boolean };
type SubscriptionResult = { providerSubscriptionId?: string; status?: string; approvalUrl?: string | null };

export default function SupportSandboxTestClient({ kennelName, kennelSlug, initialPending }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [subscription, setSubscription] = useState<SubscriptionResult | null>(null);
  const [pending, setPending] = useState(initialPending); const [clearing, setClearing] = useState(false); const [clearConfirming, setClearConfirming] = useState(false);

  async function clearPending() { setClearing(true); setError(""); try { const response = await fetch("/api/test/support-sandbox/clear-pending", { method: "POST" }); const data = await response.json(); if (!response.ok) { setError(data.error ?? "The pending PayPal sandbox subscription could not be cleared. No ShowRing subscription data was changed."); setClearing(false); return; } setPending(false); setClearConfirming(false); } catch { setError("The pending PayPal sandbox subscription could not be cleared. No ShowRing subscription data was changed."); setClearing(false); } }

  async function createSubscription() {
    if (creating || subscription) return;
    setCreating(true); setError("");
    try {
      const response = await fetch("/api/support/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: "BRONZE" }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "The sandbox subscription could not be created. No retry was attempted."); setCreating(false); return; }
      setSubscription(data.subscription ?? {});
    } catch {
      setError("The sandbox subscription could not be created. No retry was attempted."); setCreating(false);
    }
  }

  return <section className="theme-card rounded-2xl p-5">
    <p className="theme-heading font-semibold">Signed in as {kennelName}</p>
    <p className="theme-copy mt-1 text-sm">Kennel: {kennelSlug}</p>
    {pending ? <div className="theme-status-warning mt-5 rounded-2xl px-4 py-3 text-sm"><p>This removes the current unapproved PayPal sandbox subscription from testing so you can start the Bronze approval flow again. It cannot clear an active or paid subscription.</p>{clearConfirming ? <div className="mt-3"><p>Clear this unapproved sandbox subscription and allow a new Bronze test?</p><div className="mt-3 flex gap-3"><button type="button" className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold" disabled={clearing} onClick={() => setClearConfirming(false)}>Cancel</button><button type="button" className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold" disabled={clearing} onClick={clearPending}>{clearing ? "Clearing pending test..." : "Clear Pending Test"}</button></div></div> : <button type="button" className="theme-primary-button mt-3 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => setClearConfirming(true)}>Clear Pending Sandbox Test Subscription</button>}</div> : subscription ? <div className="theme-status-success mt-5 rounded-2xl px-4 py-3 text-sm">
      <p className="font-semibold">Subscription created. Complete approval in PayPal Sandbox. Do not create another subscription.</p>
      <p className="mt-2">Bronze Supporter / $2 per month</p>
      {subscription.providerSubscriptionId ? <p className="mt-1">PayPal sandbox subscription ID: {subscription.providerSubscriptionId}</p> : null}
      {subscription.status ? <p className="mt-1">Current ShowRing support status: {subscription.status}</p> : null}
      {subscription.approvalUrl ? <a className="theme-accent-link mt-3 inline-block font-semibold" href={subscription.approvalUrl}>Continue to PayPal Sandbox Approval</a> : null}
    </div> : confirming ? <div className="theme-status-warning mt-5 rounded-2xl px-4 py-3 text-sm">
      <p>Create one $2/month Bronze PayPal sandbox subscription for this ShowRing test account?</p>
      <div className="mt-3 flex gap-3"><button type="button" className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold" disabled={creating} onClick={() => setConfirming(false)}>Cancel</button><button type="button" className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" disabled={creating} onClick={createSubscription}>{creating ? "Creating sandbox subscription..." : "Create Bronze Subscription"}</button></div>
    </div> : <button type="button" className="theme-primary-button mt-5 rounded-xl px-4 py-2 text-sm font-semibold" onClick={() => setConfirming(true)}>Create Bronze Sandbox Subscription</button>}
    {error ? <p role="alert" className="theme-status-danger mt-4 rounded-2xl px-4 py-3 text-sm">{error}</p> : null}
  </section>;
}
