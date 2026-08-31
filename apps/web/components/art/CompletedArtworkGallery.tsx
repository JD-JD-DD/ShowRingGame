import Link from "next/link";

import type { ArtCampaignReadDto } from "@/server/services/artCampaign.service";

function supporterLabel(count: number) {
  return `Funded by ${new Intl.NumberFormat().format(count)} ${count === 1 ? "supporter" : "supporters"}`;
}

export default function CompletedArtworkGallery({ campaigns }: { campaigns: ArtCampaignReadDto[] }) {
  return <section className="mt-12" aria-labelledby="completed-artwork-heading">
    <h2 id="completed-artwork-heading" className="theme-heading text-2xl font-semibold">Completed Artwork</h2>
    <p className="theme-copy mt-2">Browse breed artwork completed through the ShowRing Breed Art Fund.</p>
    {campaigns.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => <article key={campaign.id} className="theme-card overflow-hidden rounded-2xl p-4">
        <img src={campaign.artworkAssetReference!} alt={campaign.artworkArtistCredit ? `${campaign.breedName} artwork by ${campaign.artworkArtistCredit}` : `${campaign.breedName} artwork`} className="theme-panel aspect-[4/3] w-full rounded-xl object-cover" />
        <p className="theme-label mt-4 text-xs font-semibold uppercase tracking-[0.16em]">{campaign.breedGroupName ?? "Breed artwork"}</p>
        <h3 className="theme-heading mt-1 text-xl font-semibold">{campaign.breedName}</h3>
        {campaign.artworkArtistCredit ? <p className="theme-copy mt-2 text-sm">Artwork by {campaign.artworkArtistCredit}</p> : null}
        {campaign.recognition ? <p className="theme-copy mt-2 text-sm font-semibold">{supporterLabel(campaign.recognition.supporterCount)}</p> : null}
        <details className="theme-panel mt-4 rounded-xl p-3 text-sm">
          <summary className="theme-copy cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">View artwork details</summary>
          <img src={campaign.artworkAssetReference!} alt="" className="theme-panel mt-3 aspect-[4/3] w-full rounded-xl object-cover" />
          {campaign.artworkCompletedAt ? <p className="theme-copy mt-3">Completed {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(campaign.artworkCompletedAt)}</p> : null}
          {campaign.recognition ? <ul className="theme-copy mt-3 list-disc space-y-1 pl-5">
            {campaign.recognition.publicKennels.map((kennel) => <li key={kennel.kennelSlug}><Link href={`/kennels/${kennel.kennelSlug}`} className="font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{kennel.kennelName}</Link></li>)}
            {campaign.recognition.anonymousSupporterCount > 0 ? <li>Anonymous {campaign.recognition.anonymousSupporterCount === 1 ? "supporter" : "supporters"}: {new Intl.NumberFormat().format(campaign.recognition.anonymousSupporterCount)}</li> : null}
          </ul> : null}
        </details>
      </article>)}
    </div> : <p className="theme-copy mt-5">No breed artwork has been completed yet.</p>}
  </section>;
}
