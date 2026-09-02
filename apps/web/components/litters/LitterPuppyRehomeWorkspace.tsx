"use client";

import { useState } from "react";

import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";

export type LitterPuppyRehomeResult = {
  rehomedCount: number;
  skipped: { dogId: string; reason: string }[];
};

function pluralizePuppies(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "puppy" : "puppies"}`;
}

export function LitterPuppyRehomeWorkspace({
  litterId,
  eligiblePuppies,
  skippedPuppies,
  onClose,
  onComplete,
}: {
  litterId: string;
  eligiblePuppies: LitterPuppyDto[];
  skippedPuppies: LitterPuppyDto[];
  onClose: () => void;
  onComplete: (result: LitterPuppyRehomeResult) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isRehoming, setIsRehoming] = useState(false);

  async function rehomePuppies(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRehoming || eligiblePuppies.length === 0) return;
    setIsRehoming(true);
    setError(null);
    try {
      const response = await fetch(`/api/litters/${litterId}/puppies/bulk-rehome`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ dogIds: eligiblePuppies.map((puppy) => puppy.dogId) }),
      });
      const data = (await response.json().catch(() => ({}))) as LitterPuppyRehomeResult & { error?: string; ok?: boolean };
      if (!response.ok || data.ok === false) {
        setError(data.error ?? "We could not re-home these puppies. Please try again.");
        return;
      }
      onComplete(data);
    } catch {
      setError("We could not re-home these puppies. Please try again.");
    } finally {
      setIsRehoming(false);
    }
  }

  return (
    <section className="theme-card mt-5 rounded-2xl p-5" aria-labelledby="rehome-puppy-heading">
      <h3 id="rehome-puppy-heading" className="theme-heading text-lg font-semibold">Re-home {eligiblePuppies.length === 1 ? "Puppy" : "Puppies"}</h3>
      <p className="theme-copy mt-4 max-w-xl text-sm leading-6">{eligiblePuppies.length === 1 ? "Re-homing this puppy removes it from your active kennel. This action is not casually reversible. The dog will remain preserved in its pedigree, this litter record, and historical records." : "Re-homing these puppies removes them from your active kennel. This action is not casually reversible. The dogs will remain preserved in their pedigrees, this litter record, and historical records."}</p>
      {eligiblePuppies.length > 0 ? <div className="mt-5"><h4 className="theme-heading text-sm font-semibold">Puppies to re-home</h4><ul className="theme-copy mt-2 grid gap-2 text-sm">{eligiblePuppies.map((puppy) => <li key={puppy.dogId} className="rounded-xl border border-[var(--color-border)] px-3 py-2"><span className="font-semibold">{puppy.displayName}</span> · {puppy.regNumber}</li>)}</ul></div> : null}
      {skippedPuppies.length > 0 ? <div className="mt-5"><h4 className="theme-heading text-sm font-semibold">Skipped</h4><ul className="theme-copy mt-2 grid gap-2 text-sm">{skippedPuppies.map((puppy) => <li key={puppy.dogId} className="rounded-xl border border-[var(--color-border)] px-3 py-2"><span className="font-semibold">{puppy.displayName}</span> · {puppy.regNumber}<span className="block mt-1">{puppy.actionEligibility.rehomeDisabledReason ?? "This puppy is not currently available for re-home."}</span></li>)}</ul></div> : null}
      {eligiblePuppies.length === 0 ? <p className="theme-copy mt-5 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">No selected puppies can be re-homed.</p> : null}
      <form onSubmit={rehomePuppies} className="mt-5 flex flex-wrap gap-2">
        {error ? <p className="theme-status-danger basis-full rounded-xl px-3 py-2 text-sm" role="alert">{error}</p> : null}
        {eligiblePuppies.length > 0 ? <button type="submit" disabled={isRehoming} className="theme-status-danger rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">{isRehoming ? "Re-homing..." : eligiblePuppies.length === 1 ? "Confirm Re-home" : `Confirm Re-home ${pluralizePuppies(eligiblePuppies.length)}`}</button> : null}
        <button type="button" disabled={isRehoming} onClick={onClose} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Cancel</button>
      </form>
    </section>
  );
}
