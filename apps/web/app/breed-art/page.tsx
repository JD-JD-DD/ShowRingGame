import Link from "next/link";

import ArtCampaignCard from "@/components/art/ArtCampaignCard";
import BreedArtFundingBoardClient from "@/components/art/BreedArtFundingBoardClient";
import { formatArtCurrency } from "@/lib/artCampaignPresentation";
import { getSessionUserId } from "@/lib/session";
import { STANDARD_BREED_ARTWORK_FUNDING } from "@/prisma/artCampaignSeed";
import { getStandardBreedArtworkBoardSummary } from "@/server/services/artCampaign.service";
import { getKennelForUser } from "@/server/services/kennel.service";

export default async function BreedArtFundingPage() {
  try {
    const summary = await getStandardBreedArtworkBoardSummary();
    const userId = await getSessionUserId();
    const kennel = userId ? await getKennelForUser(userId) : null;

    return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Breed Art Funding</p>
        <h1 className="theme-heading mt-2 text-3xl font-semibold sm:text-4xl">Help fund the ShowRing breed artwork collection</h1>
        <p className="theme-copy mt-4 text-base leading-7">ShowRing is building a collection of original breed artwork created by independent artists. Players can help choose what comes next by contributing toward the breeds they would most like to see illustrated.</p>
      </header>

      <section className="theme-card theme-copy mt-6 rounded-2xl p-5 text-sm leading-6" aria-label="Breed artwork funding details">
        <p>Each breed illustration costs {formatArtCurrency(STANDARD_BREED_ARTWORK_FUNDING.fundingGoalCents)} to commission.</p>
        <p className="mt-2">{formatArtCurrency(STANDARD_BREED_ARTWORK_FUNDING.artistAllocationCents)} compensates the artist. {formatArtCurrency(STANDARD_BREED_ARTWORK_FUNDING.showRingAllocationCents)} supports ShowRing development and operating expenses.</p>
        <p className="mt-2">Contributions will be available in {formatArtCurrency(STANDARD_BREED_ARTWORK_FUNDING.fundingUnitCents)} increments.</p>
      </section>

      <section className="theme-panel mt-6 rounded-2xl p-5 sm:p-6" aria-label="Breed artwork collection progress">
        <div className="grid gap-4 sm:grid-cols-2">
          <p className="theme-heading text-2xl font-semibold"><span className="block text-4xl">{new Intl.NumberFormat().format(summary.fundedCampaignCount)} of {new Intl.NumberFormat().format(summary.totalEligibleCampaignCount)}</span>breeds funded</p>
          <p className="theme-heading text-2xl font-semibold"><span className="block text-4xl">{new Intl.NumberFormat().format(summary.drawingCompleteCount)}</span>drawings complete</p>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="help-finish-heading">
        <h2 id="help-finish-heading" className="theme-heading text-2xl font-semibold">Help Finish a Breed</h2>
        <p className="theme-copy mt-2">These breeds are closest to reaching their artwork funding goal.</p>
        {summary.helpFinishCampaigns.length ? <div className="mt-5 grid gap-4 md:grid-cols-3">{summary.helpFinishCampaigns.map((campaign) => <ArtCampaignCard key={campaign.id} campaign={campaign} creditKennelName={kennel?.name} />)}</div> : <p className="theme-copy mt-5">No campaigns currently need funding.</p>}
      </section>

      <section className="mt-12" aria-labelledby="funding-board-heading">
        <div>
          <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Collection</p>
          <h2 id="funding-board-heading" className="theme-heading mt-2 text-2xl font-semibold">Breed Art Funding Board</h2>
          <p className="theme-copy mt-2">Browse the current Standard Breed Artwork collection.</p>
        </div>
        {summary.campaigns.length ? <BreedArtFundingBoardClient campaigns={summary.campaigns} creditKennelName={kennel?.name} /> : <p className="theme-copy mt-5">No breed artwork campaigns are available right now.</p>}
      </section>

      <section className="theme-panel mt-12 rounded-2xl p-5 sm:p-6" aria-labelledby="artists-heading">
        <h2 id="artists-heading" className="theme-heading text-2xl font-semibold">Interested in contributing art to ShowRing?</h2>
        <p className="theme-copy mt-3 leading-7">We&apos;re interested in working with artists who love dogs and would like to contribute to ShowRing&apos;s growing art collection.</p>
        <Link href="/inbox/messages/start/devtest" className="theme-copy mt-3 inline-block font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Message us to learn more.</Link>
      </section>
    </main>;
  } catch {
    return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><section className="theme-card rounded-2xl p-5"><h1 className="theme-heading text-2xl font-semibold">Breed Art Funding</h1><p className="theme-copy mt-3">Unable to load breed artwork campaigns right now. Please try again later.</p></section></main>;
  }
}
