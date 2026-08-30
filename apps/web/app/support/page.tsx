import SupportEnrollment from "@/components/support/SupportEnrollment";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { SUPPORT_BADGE_ONLY_BENEFIT, SUPPORT_FAQ, SUPPORT_POLICY_STATEMENT } from "@/lib/supportPresentation";
import { getCanonicalSupportSubscription } from "@/server/services/supportSubscription.service";

type SupportPageProps = { searchParams: Promise<{ paypal?: string }> };

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const userId = await getSessionUserId();
  const currentSubscription = userId
    ? await getCanonicalSupportSubscription({ userId })
    : null;
  const { paypal } = await searchParams;

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="max-w-3xl">
      <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">ShowRing Support</p>
      <h1 className="theme-heading mt-2 text-3xl font-semibold sm:text-4xl">Support ShowRing Game</h1>
      <p className="theme-copy mt-4 text-base leading-7">ShowRing is actively developed. Optional monthly support helps fund continued development and operating costs such as hosting and artwork.</p>
    </header>
    <section className="theme-card theme-copy mt-6 rounded-2xl p-5 text-sm leading-6"><p className="font-semibold">{SUPPORT_POLICY_STATEMENT}</p><p className="mt-3">{SUPPORT_BADGE_ONLY_BENEFIT}</p><p className="mt-3">Support is optional and can be cancelled. Future Premium convenience features will be announced separately; no supporter tier is promised to map to a future Premium tier.</p></section>
    <SupportEnrollment isAuthenticated={Boolean(userId)} currentSubscription={currentSubscription ? { tier: currentSubscription.currentTier, status: currentSubscription.status } : null} wasCancelled={paypal === "cancelled"} />
    <section aria-labelledby="support-faq-heading" className="theme-panel mt-10 rounded-2xl p-5 sm:p-6"><h2 id="support-faq-heading" className="theme-heading text-2xl font-semibold">Support FAQ</h2><div className="mt-5 grid gap-4">{SUPPORT_FAQ.map((item) => <div key={item.question} className="theme-card rounded-xl p-4"><h3 className="theme-heading font-semibold">{item.question}</h3><p className="theme-copy mt-2 text-sm leading-6">{item.answer}</p></div>)}</div></section>
  </main>;
}
