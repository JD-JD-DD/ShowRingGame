import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import AdminArtworkCompletionForm from "@/components/art/AdminArtworkCompletionForm";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { listFundedArtCampaigns } from "@/server/services/artworkCompletion.service";

export default async function AdminBreedArtPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const user = await db.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) notFound();
  const campaigns = await listFundedArtCampaigns();

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <section className="theme-panel rounded-2xl p-5 sm:p-6">
      <p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Administration</p>
      <h1 className="theme-heading mt-2 text-3xl font-semibold">Breed Art Completion</h1>
      <p className="theme-copy mt-3">Funded artwork awaiting manual approval and completion.</p>
    </section>
    <section className="mt-6" aria-labelledby="funded-artwork-heading">
      <h2 id="funded-artwork-heading" className="theme-heading text-2xl font-semibold">Funded — Awaiting Artwork</h2>
      {campaigns.length ? <div className="mt-4 grid gap-4">{campaigns.map((campaign: any) => <article key={campaign.id} className="theme-card rounded-2xl p-5">
        <p className="theme-label text-xs font-semibold uppercase tracking-[0.16em]">{campaign.breed.groupName ?? "Breed artwork"}</p>
        <h3 className="theme-heading mt-1 text-xl font-semibold">{campaign.breed.name}</h3>
        <p className="theme-copy mt-2 text-sm">{campaign.title}</p>
        {campaign.fundedAt ? <p className="theme-copy mt-2 text-sm">Funded {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(campaign.fundedAt)}</p> : null}
        <AdminArtworkCompletionForm campaignId={campaign.id} breedName={campaign.breed.name} />
      </article>)}</div> : <p className="theme-copy mt-4">No funded artwork is awaiting completion.</p>}
    </section>
    <Link href="/breed-art" className="theme-secondary-button mt-8 inline-flex rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">View public Breed Art page</Link>
  </main>;
}
