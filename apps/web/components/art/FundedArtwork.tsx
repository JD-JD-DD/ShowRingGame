import type { ArtCampaignReadDto } from "@/server/services/artCampaign.service";

import ArtCampaignCard from "./ArtCampaignCard";

export default function FundedArtwork({ campaigns }: { campaigns: ArtCampaignReadDto[] }) {
  return <section className="mt-12" aria-labelledby="funded-artwork-heading">
    <h2 id="funded-artwork-heading" className="theme-heading text-2xl font-semibold">Funded Artwork</h2>
    <p className="theme-copy mt-2">These breed artworks are fully funded and awaiting completion.</p>
    {campaigns.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => <ArtCampaignCard key={campaign.id} campaign={campaign} />)}
    </div> : <p className="theme-copy mt-5">No funded artwork is currently awaiting completion.</p>}
  </section>;
}
