import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSessionUserId } from "@/lib/session";
import { ArtPaymentAttemptError, getArtPaymentAttemptForReturn } from "@/server/services/artPaymentAttempt.service";

export default async function BreedArtCheckoutReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const { attemptId } = await params;
  const { cancelled } = await searchParams;
  try {
    const attempt = await getArtPaymentAttemptForReturn({ userId, attemptId, cancelled: cancelled === "1" });
    const cancelledByPayer = attempt.status === "CANCELLED";
    const approved = attempt.status === "APPROVED";
    return <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8"><section className="theme-card rounded-2xl p-5 sm:p-6"><h1 className="theme-heading text-2xl font-semibold">Breed Art contribution checkout</h1>{cancelledByPayer ? <p className="theme-copy mt-3">PayPal checkout was cancelled. No contribution was made.</p> : approved ? <><p className="theme-copy mt-3">Your PayPal approval was received. Funding availability is confirmed when your contribution is finalized.</p><p className="theme-copy mt-2">No contribution has been finalized yet.</p></> : <p className="theme-copy mt-3">We&apos;re checking your PayPal approval. Funding availability is confirmed when your contribution is finalized.</p>}<Link href="/breed-art" className="theme-secondary-button mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Back to Breed Art</Link></section></main>;
  } catch (error) {
    if (error instanceof ArtPaymentAttemptError) notFound();
    throw error;
  }
}
