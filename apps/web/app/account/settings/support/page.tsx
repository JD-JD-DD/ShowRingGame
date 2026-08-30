import { redirect } from "next/navigation";
import Link from "next/link";

import ReconcileSupportStatusButton from "@/components/support/ReconcileSupportStatusButton";
import SupportManagementAffordances from "@/components/support/SupportManagementAffordances";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  formatSupportAmount,
  getSupportStatusLabel,
  getSupportTierPresentation,
  type SupportPresentationTierValue,
  type SupportStatusPresentationValue,
} from "@/lib/supportPresentation";
import { getCanonicalSupportSubscription } from "@/server/services/supportSubscription.service";

type SupportStatusPageProps = { searchParams: Promise<{ paypal?: string }> };

function formatDate(value: Date | null): string | null {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(value) : null;
}

type SupportSubscriptionView = {
  currentTier: SupportPresentationTierValue;
  status: SupportStatusPresentationValue;
  firstSupportedAt: Date | null;
  currentPaidPeriodEnd: Date | null;
};

function SupportDetails({ subscription, pendingDowngrade, changeInProgress }: { subscription: SupportSubscriptionView; pendingDowngrade: { targetTier: SupportPresentationTierValue; expectedEffectiveAt: Date | null } | null; changeInProgress: boolean }) {
  const tier = getSupportTierPresentation(subscription.currentTier);
  const firstSupported = formatDate(subscription.firstSupportedAt);
  const periodEnd = formatDate(subscription.currentPaidPeriodEnd);

  return <section className="theme-card mt-6 rounded-2xl p-5">
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="theme-label font-semibold">Current level</dt><dd className="theme-copy mt-1">{tier.label}</dd></div>
      <div><dt className="theme-label font-semibold">Monthly amount</dt><dd className="theme-copy mt-1">{formatSupportAmount(tier.monthlyAmount)}/month</dd></div>
      <div><dt className="theme-label font-semibold">Status</dt><dd className="theme-copy mt-1">{getSupportStatusLabel(subscription.status)}</dd></div>
      <div><dt className="theme-label font-semibold">Provider</dt><dd className="theme-copy mt-1">PayPal</dd></div>
      {firstSupported ? <div><dt className="theme-label font-semibold">First supported</dt><dd className="theme-copy mt-1">{firstSupported}</dd></div> : null}
      {subscription.status === "ACTIVE" && periodEnd ? <div><dt className="theme-label font-semibold">Next billing date</dt><dd className="theme-copy mt-1">{periodEnd}</dd></div> : null}
      {subscription.status === "PAYMENT_RETRY" && periodEnd ? <div><dt className="theme-label font-semibold">Billing information</dt><dd className="theme-copy mt-1">{periodEnd}</dd></div> : null}
      {subscription.status === "CANCELLATION_SCHEDULED" && periodEnd ? <div><dt className="theme-label font-semibold">Support ends</dt><dd className="theme-copy mt-1">{periodEnd}</dd></div> : null}
    </dl>
    {subscription.status === "ACTIVE" ? <><p className="theme-copy mt-5 text-sm">Your Supporter badge remains eligible for display.</p>{changeInProgress ? <p role="status" className="theme-status-info mt-5 rounded-xl px-3 py-2 text-sm">A support-level change is in progress. Your current support remains active until PayPal confirms the change.</p> : <SupportManagementAffordances currentTier={subscription.currentTier} paidThrough={subscription.currentPaidPeriodEnd} />}</> : null}
    {pendingDowngrade ? <p role="status" className="theme-status-info mt-5 rounded-xl px-3 py-2 text-sm">Change to {getSupportTierPresentation(pendingDowngrade.targetTier).label} pending{pendingDowngrade.expectedEffectiveAt ? ` for ${formatDate(pendingDowngrade.expectedEffectiveAt)}` : ""}. Your current level remains active until PayPal applies the change.</p> : null}
    {subscription.status === "PENDING" ? <><p className="theme-status-info mt-5 rounded-xl px-3 py-2 text-sm">Your support confirmation may take a short time to appear.</p><ReconcileSupportStatusButton /></> : null}
    {subscription.status === "PAYMENT_RETRY" ? <p className="theme-status-info mt-5 rounded-xl px-3 py-2 text-sm">PayPal was unable to complete a support payment. Your supporter recognition remains active while PayPal handles payment recovery. PayPal may retry the payment automatically.</p> : null}
    {subscription.status === "CANCELLATION_SCHEDULED" ? <div className="theme-card theme-copy mt-5 rounded-xl p-4 text-sm"><p>Your recurring PayPal subscription has been cancelled. Your supporter recognition will remain active through the end of your paid support period. No further recurring charges are scheduled.</p><p className="mt-2">{periodEnd ? `Support remains active through ${periodEnd}.` : "Support remains active through the current paid period."}</p></div> : null}
  </section>;
}

export default async function SupportStatusPage({ searchParams }: SupportStatusPageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=%2Faccount%2Fsettings%2Fsupport");
  const subscription = await getCanonicalSupportSubscription({ userId });
  const liveChange = await (db as any).supportSubscriptionChange.findFirst({ where: { userId, status: { in: ["PENDING_APPROVAL", "TARGET_ACTIVE_CANCELLATION_PENDING", "CLEANUP_FAILED"] } }, select: { id: true } });
  const pendingDowngrade = subscription ? await (db as any).supportSubscriptionChange.findFirst({ where: { sourceSupportSubscriptionId: subscription.id, type: "DOWNGRADE", status: "PENDING_APPROVAL" }, select: { targetTier: true, expectedEffectiveAt: true } }) : null;
  const formerSubscription = subscription ? null : await (db as any).supportSubscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { currentTier: true, firstSupportedAt: true },
  });
  const { paypal } = await searchParams;

  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <header><p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Account Settings</p><h1 className="theme-heading mt-2 text-3xl font-semibold">Support Status</h1></header>
    {paypal === "approved" ? <p role="status" className="theme-status-info mt-6 rounded-2xl px-4 py-3 text-sm">PayPal approval received. Confirming your support status…</p> : null}
    {subscription ? <SupportDetails subscription={subscription as SupportSubscriptionView} pendingDowngrade={pendingDowngrade as { targetTier: SupportPresentationTierValue; expectedEffectiveAt: Date | null } | null} changeInProgress={Boolean(liveChange)} /> : formerSubscription ? <section className="theme-card mt-6 rounded-2xl p-5"><p className="theme-heading font-semibold">Thank you for supporting ShowRing during development.</p><dl className="theme-copy mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="theme-label font-semibold">First supported</dt><dd className="mt-1">{formatDate(formerSubscription.firstSupportedAt) ?? "Unavailable"}</dd></div><div><dt className="theme-label font-semibold">Previous level</dt><dd className="mt-1">{getSupportTierPresentation(formerSubscription.currentTier as SupportPresentationTierValue).label}</dd></div><div><dt className="theme-label font-semibold">Current status</dt><dd className="mt-1">Not currently supporting</dd></div></dl><Link href="/support" className="theme-primary-button mt-6 inline-flex rounded-xl px-4 py-2 text-sm font-semibold">Support Again</Link></section> : <section className="theme-card mt-6 rounded-2xl p-5"><p className="theme-copy text-sm">You are not currently supporting ShowRing.</p><Link href="/support" className="theme-primary-button mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-semibold">Support ShowRing</Link></section>}
  </main>;
}
