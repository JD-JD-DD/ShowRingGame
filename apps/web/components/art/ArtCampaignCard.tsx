"use client";

import Link from "next/link";

import { formatArtCurrency, getArtCampaignStatusLabel } from "@/lib/artCampaignPresentation";
import type { ArtCampaignReadDto } from "@/server/services/artCampaign.service";

import ArtCampaignContributionForm from "./ArtCampaignContributionForm";

export default function ArtCampaignCard({ campaign, creditKennelName }: { campaign: ArtCampaignReadDto; creditKennelName?: string | null }) {
  const { progress } = campaign;
  const amountSummary = `${formatArtCurrency(progress.amountFundedCents)} of ${formatArtCurrency(progress.fundingGoalCents)} funded`;

  return <article className="theme-card rounded-2xl p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.16em]">{campaign.breedGroupName ?? "Breed artwork"}</p>
        <h3 className="theme-heading mt-1 text-xl font-semibold">{campaign.breedName}</h3>
      </div>
      <p className="theme-copy rounded-full border px-3 py-1 text-xs font-semibold">{getArtCampaignStatusLabel(campaign.status)}</p>
    </div>

    {campaign.status === "DRAWING_COMPLETE" && campaign.artworkAssetReference ? (
      <img src={campaign.artworkAssetReference} alt={`${campaign.breedName} artwork`} className="theme-panel mt-4 aspect-[4/3] w-full rounded-xl object-cover" />
    ) : (
      <div aria-hidden="true" className="theme-panel mt-4 aspect-[4/3] rounded-xl" />
    )}

    <div className="mt-4">
      <p className="theme-copy text-sm font-semibold">{amountSummary}</p>
      {progress.canAcceptContributions ? <p className="theme-copy mt-1 text-sm">{formatArtCurrency(progress.amountRemainingCents)} remaining</p> : null}
      <progress className="mt-3 h-3 w-full" value={progress.amountFundedCents} max={progress.fundingGoalCents} aria-label={`${campaign.breedName}: ${amountSummary}`}>
        {amountSummary}
      </progress>
    </div>
    {campaign.recognition ? <details className="theme-panel mt-4 rounded-xl p-3 text-sm">
      <summary className="theme-copy cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Funded by {new Intl.NumberFormat().format(campaign.recognition.supporterCount)} {campaign.recognition.supporterCount === 1 ? "supporter" : "supporters"}</summary>
      <ul className="theme-copy mt-3 list-disc space-y-1 pl-5">
        {campaign.recognition.publicKennels.map((kennel) => <li key={kennel.kennelSlug}><Link href={`/kennels/${kennel.kennelSlug}`} className="font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{kennel.kennelName}</Link></li>)}
        {campaign.recognition.anonymousSupporterCount > 0 ? <li>Anonymous {campaign.recognition.anonymousSupporterCount === 1 ? "supporter" : "supporters"}: {new Intl.NumberFormat().format(campaign.recognition.anonymousSupporterCount)}</li> : null}
      </ul>
    </details> : null}
    {campaign.status === "NEEDS_FUNDING" && progress.canAcceptContributions ? <ArtCampaignContributionForm campaign={campaign} creditKennelName={creditKennelName} /> : null}
  </article>;
}
