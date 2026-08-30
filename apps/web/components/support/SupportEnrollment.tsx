"use client";

import Link from "next/link";
import { useState } from "react";

import {
  formatSupportAmount,
  SUPPORT_TIERS,
  type SupportPresentationTier,
} from "@/lib/supportPresentation";

type CurrentSubscription = {
  tier: string;
  status: string;
} | null;

type SupportEnrollmentProps = {
  isAuthenticated: boolean;
  currentSubscription: CurrentSubscription;
  wasCancelled: boolean;
};

function BadgePreview({ tier }: { tier: SupportPresentationTier }) {
  const badgeClass = {
    BRONZE: "bg-amber-700 text-white",
    SILVER: "bg-slate-600 text-white",
    GOLD: "bg-yellow-500 text-slate-950",
  }[tier.tier];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${badgeClass}`}>
      <span aria-hidden="true">✿</span>
      <span>{tier.label} badge preview</span>
    </span>
  );
}

export default function SupportEnrollment({
  isAuthenticated,
  currentSubscription,
  wasCancelled,
}: SupportEnrollmentProps) {
  const [selectedTier, setSelectedTier] = useState<SupportPresentationTier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function startSupport() {
    if (!selectedTier || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/support/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier.tier }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data !== null && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Unable to start support right now. Please try again later.";
        setError(message);
        setIsSubmitting(false);
        return;
      }
      const approvalUrl =
        data !== null && typeof data === "object" && "subscription" in data &&
        data.subscription !== null && typeof data.subscription === "object" &&
        "approvalUrl" in data.subscription && typeof data.subscription.approvalUrl === "string"
          ? data.subscription.approvalUrl
          : null;
      if (!approvalUrl) {
        setError("Unable to start support right now. Please try again later.");
        setIsSubmitting(false);
        return;
      }
      window.location.assign(approvalUrl);
    } catch {
      setError("Unable to start support right now. Please try again later.");
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="support-tiers-heading" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="support-tiers-heading" className="theme-heading text-2xl font-semibold">Choose your support level</h2>
          <p className="theme-copy mt-1 text-sm">All levels are optional monthly support and can be cancelled anytime.</p>
        </div>
      </div>

      {wasCancelled ? (
        <p role="status" className="theme-status-info mt-4 rounded-2xl px-4 py-3 text-sm">
          Support setup was cancelled. No new support subscription was completed.
        </p>
      ) : null}

      {currentSubscription ? (
        <div className="theme-card mt-5 rounded-2xl p-5">
          <p className="theme-heading font-semibold">You already have current ShowRing Support.</p>
          <p className="theme-copy mt-2 text-sm">Current level: {currentSubscription.tier}. Status: {currentSubscription.status === "CANCELLATION_SCHEDULED" ? "Cancellation Scheduled" : currentSubscription.status}.</p>
          <Link href="/account/settings/support" className="theme-primary-button mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold">
            View Support Status
          </Link>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {SUPPORT_TIERS.map((tier) => (
          <article key={tier.tier} className="theme-card flex min-w-0 flex-col rounded-2xl p-5">
            <BadgePreview tier={tier} />
            <h3 className="theme-heading mt-4 text-xl font-semibold">{tier.label}</h3>
            <p className="theme-heading mt-2 text-2xl font-bold">{formatSupportAmount(tier.monthlyAmount)}<span className="text-base font-medium">/month</span></p>
            <p className="theme-copy mt-3 text-sm">Voluntary monthly support. Cancel anytime.</p>
            {currentSubscription ? (
              <p className="theme-copy mt-5 text-sm">Enrollment is unavailable while your current support subscription is active.</p>
            ) : isAuthenticated ? (
              <button type="button" onClick={() => { setSelectedTier(tier); setError(""); }} className="theme-primary-button mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold">
                Support with PayPal
              </button>
            ) : (
              <Link href="/login?next=%2Fsupport" className="theme-primary-button mt-5 rounded-xl px-4 py-2.5 text-center text-sm font-semibold">
                Log in to support
              </Link>
            )}
          </article>
        ))}
      </div>

      {selectedTier ? (
        <section role="dialog" aria-modal="true" aria-labelledby="support-confirmation-heading" className="theme-panel mt-6 rounded-2xl p-5">
          <h3 id="support-confirmation-heading" className="theme-heading text-lg font-semibold">
            Start {selectedTier.label} for {formatSupportAmount(selectedTier.monthlyAmount)} per month?
          </h3>
          <p className="theme-copy mt-2 text-sm">You will continue to PayPal to review and approve this recurring support subscription.</p>
          {error ? <p role="alert" className="theme-status-danger mt-4 rounded-xl px-3 py-2 text-sm">{error}</p> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" disabled={isSubmitting} onClick={() => { setSelectedTier(null); setError(""); }} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
            <button type="button" disabled={isSubmitting} onClick={startSupport} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? "Starting support..." : "Continue to PayPal"}
            </button>
          </div>
          {isSubmitting ? <p role="status" className="theme-copy mt-3 text-sm">Creating your support subscription…</p> : null}
        </section>
      ) : null}
    </section>
  );
}
