"use client";

import { useState } from "react";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";

export function LitterPuppySaleWorkspace({
  litterId,
  puppy,
  onClose,
  onAuthoritativeRefresh,
}: {
  litterId: string;
  puppy: LitterPuppyDto;
  onClose: () => void;
  onAuthoritativeRefresh: () => void;
}) {
  const [askingPrice, setAskingPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function listPuppy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || !puppy.actionEligibility.canListForSale) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/litters/${litterId}/puppies/${puppy.dogId}/list-for-sale`,
        {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ askingPrice }),
        }
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!response.ok || data.ok === false) {
        setError(data.error ?? "Failed to list puppy for sale.");
        onAuthoritativeRefresh();
        return;
      }

      onClose();
      onAuthoritativeRefresh();
    } catch {
      setError("Failed to list puppy for sale.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="theme-card mt-5 rounded-2xl p-5" aria-labelledby="sale-puppy-heading">
      <h3 id="sale-puppy-heading" className="theme-heading text-lg font-semibold">
        Put Up for Sale
      </h3>
      <p className="theme-copy mt-1 text-sm">{puppy.displayName} · {puppy.regNumber}</p>

      <form onSubmit={listPuppy} className="mt-5 grid max-w-xl gap-4">
        <label className="grid gap-2 text-sm font-semibold" htmlFor="litter-puppy-asking-price">
          Sale price
          <input
            id="litter-puppy-asking-price"
            type="number"
            value={askingPrice}
            min={1}
            step={1}
            required
            inputMode="numeric"
            onChange={(event) => setAskingPrice(event.target.value)}
            placeholder="Whole dollars"
            className="dog-control rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          />
        </label>

        {error ? <p className="theme-status-danger rounded-xl px-3 py-2 text-sm" role="alert">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSaving || !puppy.actionEligibility.canListForSale}
            className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          >
            {isSaving ? "Listing..." : "Put Up for Sale"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
