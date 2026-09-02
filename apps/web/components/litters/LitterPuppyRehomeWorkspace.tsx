"use client";

import { useState } from "react";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";

export function LitterPuppyRehomeWorkspace({
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
  const [error, setError] = useState<string | null>(null);
  const [isRehoming, setIsRehoming] = useState(false);

  async function rehomePuppy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRehoming || !puppy.actionEligibility.canRehome) return;

    setIsRehoming(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/litters/${litterId}/puppies/${puppy.dogId}/rehome`,
        { method: "POST", headers: { Accept: "application/json" } }
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!response.ok || data.ok === false) {
        setError(data.error ?? "We could not re-home this puppy. Please try again.");
        onAuthoritativeRefresh();
        return;
      }

      onClose();
      onAuthoritativeRefresh();
    } catch {
      setError("We could not re-home this puppy. Please try again.");
    } finally {
      setIsRehoming(false);
    }
  }

  return (
    <section className="theme-card mt-5 rounded-2xl p-5" aria-labelledby="rehome-puppy-heading">
      <h3 id="rehome-puppy-heading" className="theme-heading text-lg font-semibold">
        Re-home Puppy
      </h3>
      <p className="theme-copy mt-1 text-sm">{puppy.displayName} · {puppy.regNumber}</p>
      <p className="theme-copy mt-4 max-w-xl text-sm leading-6">
        Re-homing this puppy removes it from your active kennel. This action is not casually reversible. The dog will remain preserved in this litter record, its pedigree, and historical records.
      </p>

      <form onSubmit={rehomePuppy} className="mt-5 flex flex-wrap gap-2">
        {error ? <p className="theme-status-danger basis-full rounded-xl px-3 py-2 text-sm" role="alert">{error}</p> : null}
        <button
          type="submit"
          disabled={isRehoming || !puppy.actionEligibility.canRehome}
          className="theme-status-danger rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRehoming ? "Re-homing..." : "Confirm Re-home"}
        </button>
        <button
          type="button"
          disabled={isRehoming}
          onClick={onClose}
          className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </form>
    </section>
  );
}
