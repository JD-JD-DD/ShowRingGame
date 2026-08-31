"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminArtworkCompletionForm({ campaignId, breedName }: { campaignId: string; breedName: string }) {
  const router = useRouter();
  const [artistCredit, setArtistCredit] = useState("");
  const [assetReference, setAssetReference] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/breed-art/${campaignId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artistCredit, assetReference }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Unable to complete artwork campaign.");
      setMessage(data?.result?.state === "ALREADY_COMPLETED" ? `${breedName} artwork is already complete.` : `${breedName} artwork marked Drawing Complete.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to complete artwork campaign.");
    } finally {
      setSubmitting(false);
    }
  }

  return <form onSubmit={submit} className="mt-4 grid gap-3" aria-label={`Complete ${breedName} artwork`}>
    <label className="theme-copy text-sm font-semibold">Artist credit<input value={artistCredit} onChange={(event) => setArtistCredit(event.target.value)} required maxLength={160} className="theme-panel mt-1 block w-full rounded-lg px-3 py-2 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" /></label>
    <label className="theme-copy text-sm font-semibold">Artwork asset reference<input value={assetReference} onChange={(event) => setAssetReference(event.target.value)} required maxLength={2048} placeholder="https://… or /artwork/…" className="theme-panel mt-1 block w-full rounded-lg px-3 py-2 font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" /></label>
    {assetReference ? <img src={assetReference} alt={`${breedName} artwork preview`} className="theme-panel aspect-[4/3] w-full rounded-xl object-cover" /> : null}
    <p className="theme-copy text-sm">Funded — Awaiting Artwork → Drawing Complete</p>
    {message ? <p role="status" className="theme-copy text-sm">{message}</p> : null}
    <button type="submit" disabled={submitting} className="theme-primary-button w-fit rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{submitting ? "Completing…" : "Mark Drawing Complete"}</button>
  </form>;
}
