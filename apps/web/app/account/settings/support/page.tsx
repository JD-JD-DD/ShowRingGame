import { redirect } from "next/navigation";

import RefreshSupportStatusButton from "@/components/support/RefreshSupportStatusButton";
import ReconcileSupportStatusButton from "@/components/support/ReconcileSupportStatusButton";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { formatSupportAmount, getSupportTierPresentation, type SupportPresentationTierValue } from "@/lib/supportPresentation";
import { CURRENT_SUPPORT_STATUSES } from "@/server/services/supportSubscription.service";

type SupportStatusPageProps = { searchParams: Promise<{ paypal?: string }> };

function formatDate(value: Date | null): string | null {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(value) : null;
}

export default async function SupportStatusPage({ searchParams }: SupportStatusPageProps) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=%2Faccount%2Fsettings%2Fsupport");
  const subscription = await (db as any).supportSubscription.findFirst({
    where: { userId, status: { in: CURRENT_SUPPORT_STATUSES } },
    orderBy: { createdAt: "desc" },
    select: { currentTier: true, status: true, provider: true, firstSupportedAt: true, currentPaidPeriodEnd: true },
  });
  const { paypal } = await searchParams;
  const tier = subscription ? getSupportTierPresentation(subscription.currentTier as SupportPresentationTierValue) : null;

  return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <header><p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Account Settings</p><h1 className="theme-heading mt-2 text-3xl font-semibold">Support Status</h1></header>
    {paypal === "approved" ? <p role="status" className="theme-status-info mt-6 rounded-2xl px-4 py-3 text-sm">PayPal approval received. Confirming your support status…</p> : null}
    {subscription && tier ? <section className="theme-card mt-6 rounded-2xl p-5"><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="theme-label font-semibold">Support level</dt><dd className="theme-copy mt-1">{tier.label}</dd></div><div><dt className="theme-label font-semibold">Monthly amount</dt><dd className="theme-copy mt-1">{formatSupportAmount(tier.monthlyAmount)}/month</dd></div><div><dt className="theme-label font-semibold">ShowRing status</dt><dd className="theme-copy mt-1">{subscription.status}</dd></div><div><dt className="theme-label font-semibold">Provider</dt><dd className="theme-copy mt-1">PayPal</dd></div>{formatDate(subscription.firstSupportedAt) ? <div><dt className="theme-label font-semibold">First supported</dt><dd className="theme-copy mt-1">{formatDate(subscription.firstSupportedAt)}</dd></div> : null}{formatDate(subscription.currentPaidPeriodEnd) ? <div><dt className="theme-label font-semibold">Next billing period</dt><dd className="theme-copy mt-1">{formatDate(subscription.currentPaidPeriodEnd)}</dd></div> : null}</dl>{subscription.status === "PENDING" ? <><p className="theme-status-info mt-5 rounded-xl px-3 py-2 text-sm">Your support confirmation may take a short time to appear.</p><ReconcileSupportStatusButton /></> : null}</section> : <section className="theme-card mt-6 rounded-2xl p-5"><p className="theme-copy text-sm">No current ShowRing Support subscription is recorded for this account.</p></section>}
    <div className="mt-6"><RefreshSupportStatusButton /></div>
  </main>;
}
