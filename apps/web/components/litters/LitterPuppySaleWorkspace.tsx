"use client";

import { useEffect, useMemo, useState } from "react";

import { isValidWholeDollarSalePrice } from "@/components/kennel/BulkForSaleWorkspace";
import type { LitterPuppyDto } from "@/server/mappers/litter.mapper";

type SaleEligibility = { dogId: string; eligible: boolean; reasonCode: string | null; reasonMessage: string | null };
export type LitterPuppySaleResult = { listedCount: number; skipped: { dogId: string; reason: string }[] };

function pluralizePuppies(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "puppy" : "puppies"}`;
}

export function LitterPuppySaleWorkspace({
  litterId,
  eligiblePuppies,
  skippedPuppies: _skippedPuppies,
  onClose,
  onComplete,
}: {
  litterId: string;
  eligiblePuppies: LitterPuppyDto[];
  skippedPuppies: LitterPuppyDto[];
  onClose: () => void;
  onComplete: (result: LitterPuppySaleResult) => void;
}) {
  const [eligibilityByDogId, setEligibilityByDogId] = useState<Record<string, SaleEligibility>>({});
  const [pricesByDogId, setPricesByDogId] = useState<Record<string, string>>({});
  const [sellAllPrice, setSellAllPrice] = useState("");
  const [loading, setLoading] = useState(eligiblePuppies.length > 0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dogIdsKey = eligiblePuppies.map((puppy) => puppy.dogId).join(",");

  useEffect(() => {
    if (eligiblePuppies.length === 0) return;
    let isMounted = true;
    setLoading(true);
    setError(null);
    setEligibilityByDogId({});
    setPricesByDogId({});
    void fetch(`/api/litters/${litterId}/puppies/bulk-sale-preflight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dogIds: eligiblePuppies.map((puppy) => puppy.dogId) }),
    }).then(async (response) => {
      const data = (await response.json()) as { ok?: boolean; dogs?: SaleEligibility[]; error?: string };
      if (!response.ok || !data.ok || !data.dogs) throw new Error(data.error ?? "Unable to check sale eligibility.");
      const results = Object.fromEntries(data.dogs.map((result) => [result.dogId, result]));
      if (eligiblePuppies.some((puppy) => !results[puppy.dogId])) throw new Error("Eligibility results did not include every selected puppy.");
      if (isMounted) setEligibilityByDogId(results);
    }).catch((preflightError) => {
      if (isMounted) setError(preflightError instanceof Error ? preflightError.message : "Unable to check sale eligibility.");
    }).finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [dogIdsKey, eligiblePuppies, litterId]);

  const currentlyEligiblePuppies = useMemo(
    () => eligiblePuppies.filter((puppy) => eligibilityByDogId[puppy.dogId]?.eligible),
    [eligiblePuppies, eligibilityByDogId]
  );
  const invalidPriceDogIds = useMemo(() => new Set(currentlyEligiblePuppies.filter((puppy) => {
    const price = pricesByDogId[puppy.dogId] ?? "";
    return price !== "" && !isValidWholeDollarSalePrice(price);
  }).map((puppy) => puppy.dogId)), [currentlyEligiblePuppies, pricesByDogId]);
  const pricedEligiblePuppies = useMemo(
    () => currentlyEligiblePuppies.filter((puppy) => isValidWholeDollarSalePrice(pricesByDogId[puppy.dogId] ?? "")),
    [currentlyEligiblePuppies, pricesByDogId]
  );
  const formReady = !loading && !error && pricedEligiblePuppies.length > 0 && invalidPriceDogIds.size === 0;
  const sellAllPriceValid = isValidWholeDollarSalePrice(sellAllPrice);

  function applyPriceToEligiblePuppies() {
    if (!sellAllPriceValid) return;
    setPricesByDogId((current) => ({ ...current, ...Object.fromEntries(currentlyEligiblePuppies.map((puppy) => [puppy.dogId, sellAllPrice])) }));
  }

  async function submitBulkSale() {
    if (!formReady || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/litters/${litterId}/puppies/bulk-for-sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: pricedEligiblePuppies.map((puppy) => ({ dogId: puppy.dogId, askingPrice: pricesByDogId[puppy.dogId] })) }),
      });
      const data = (await response.json()) as LitterPuppySaleResult & { ok?: boolean; error?: string };
      if (!response.ok || !data.ok || typeof data.listedCount !== "number") throw new Error(data.error ?? "No puppies were listed.");
      onComplete(data);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to list puppies for sale.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="theme-card mt-5 rounded-2xl p-5" aria-labelledby="sale-puppy-heading">
      <h3 id="sale-puppy-heading" className="theme-heading text-lg font-semibold">Put Up for Sale</h3>
      {eligiblePuppies.length === 0 ? (
        <div className="mt-5 grid gap-3"><p className="theme-copy rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">No selected puppies can be listed for sale.</p><div><button type="button" onClick={onClose} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Close</button></div></div>
      ) : (
        <div className="mt-5 grid gap-4">
          <div className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="grid gap-1 text-sm font-semibold"><span>Sell All For</span><span className="flex items-center gap-2"><span aria-hidden="true">$</span><input type="text" inputMode="numeric" value={sellAllPrice} onChange={(event) => setSellAllPrice(event.target.value)} aria-label="Sell All For price" className="dog-control w-full rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200" /></span></label><button type="button" onClick={applyPriceToEligiblePuppies} disabled={loading || !sellAllPriceValid} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">Apply to All</button></div>
          {sellAllPrice && !sellAllPriceValid ? <p className="theme-status-danger rounded-xl px-3 py-2 text-sm" role="alert">Enter a whole-dollar price of at least $1.</p> : null}
          {loading ? <p className="theme-copy text-sm" role="status">Checking sale eligibility...</p> : null}
          {error ? <p className="theme-status-danger rounded-xl px-3 py-2 text-sm" role="alert">{error}</p> : null}
          <div className="grid gap-3">{eligiblePuppies.map((puppy) => {
            const eligibility = eligibilityByDogId[puppy.dogId];
            const eligible = eligibility?.eligible === true;
            const price = pricesByDogId[puppy.dogId] ?? "";
            const invalidPrice = eligible && invalidPriceDogIds.has(puppy.dogId);
            return <article key={puppy.dogId} className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,15rem)] sm:items-end"><div><p className="font-semibold">{puppy.displayName}</p><p className="theme-copy mt-1 text-sm">{puppy.regNumber}</p>{!loading && !eligible && eligibility ? <p className="theme-copy mt-2 text-sm">Not eligible — {eligibility.reasonMessage ?? "Eligibility could not be determined."}</p> : null}</div>{eligible ? <label className="grid gap-1 text-sm font-semibold"><span>Sale price</span><input type="text" inputMode="numeric" value={price} onChange={(event) => setPricesByDogId((current) => ({ ...current, [puppy.dogId]: event.target.value }))} disabled={loading} aria-label={`Sale price for ${puppy.displayName}`} className="dog-control rounded-xl px-3 py-2 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:opacity-50" />{invalidPrice ? <span className="theme-status-danger rounded-md px-2 py-1 text-xs" role="alert">Enter a whole-dollar price of at least $1.</span> : null}</label> : null}</article>;
          })}</div>
          <p className="theme-copy text-sm" role="status">{formReady ? `Ready to list ${pluralizePuppies(pricedEligiblePuppies.length)} for sale.` : currentlyEligiblePuppies.length === 0 && !loading && !error ? "No selected puppies are currently eligible for sale." : invalidPriceDogIds.size > 0 ? "Correct or clear each invalid sale price." : "Add a valid whole-dollar price for at least one eligible puppy."}</p>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={onClose} disabled={submitting} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Cancel</button><button type="button" onClick={submitBulkSale} disabled={!formReady || submitting} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">{submitting ? "Listing puppies..." : "List Puppies For Sale"}</button></div>
        </div>
      )}
    </section>
  );
}
