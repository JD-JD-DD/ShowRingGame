"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type BulkSaleDog = {
  dogId: string;
  displayName: string;
  callName: string | null;
  regNumber: string;
  ageLabel: string;
};

type SaleEligibility = {
  dogId: string;
  eligible: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
};

type BulkSalePreflightResponse = {
  ok?: boolean;
  dogs?: SaleEligibility[];
  error?: string;
};

type BulkSaleMutationResponse = {
  ok?: boolean;
  listedCount?: number;
  error?: string;
};

export function isValidWholeDollarSalePrice(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const price = Number.parseInt(value, 10);
  return Number.isSafeInteger(price) && price >= 1;
}

export default function BulkForSaleWorkspace({
  dogs,
  onClose,
  onSuccess,
}: {
  dogs: BulkSaleDog[];
  onClose: () => void;
  onSuccess: (args: { listedCount: number }) => Promise<void>;
}) {
  const [eligibilityByDogId, setEligibilityByDogId] = useState<
    Record<string, SaleEligibility>
  >({});
  const [pricesByDogId, setPricesByDogId] = useState<Record<string, string>>({});
  const [sellAllPrice, setSellAllPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [preflightRetry, setPreflightRetry] = useState(0);
  const requestSequence = useRef(0);
  const previousDogIdsKey = useRef<string | null>(null);
  const dogIdsKey = dogs.map((dog) => dog.dogId).join(",");

  useEffect(() => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    setEligibilityByDogId({});
    if (previousDogIdsKey.current !== dogIdsKey) {
      setPricesByDogId({});
      setSubmissionError(null);
      setSuccessMessage(null);
      previousDogIdsKey.current = dogIdsKey;
    }

    void fetch("/api/kennel/dogs/bulk-sale-preflight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dogIds: dogs.map((dog) => dog.dogId) }),
    })
      .then(async (response) => {
        const data = (await response.json()) as BulkSalePreflightResponse;
        if (!response.ok || !data.ok || !data.dogs) {
          throw new Error(data.error || "Unable to check sale eligibility.");
        }
        const results = Object.fromEntries(
          data.dogs.map((result) => [result.dogId, result])
        );
        if (dogs.some((dog) => !results[dog.dogId])) {
          throw new Error("Eligibility results did not include every selected dog.");
        }
        if (requestId === requestSequence.current) setEligibilityByDogId(results);
      })
      .catch((preflightError) => {
        if (requestId === requestSequence.current) {
          setError(
            preflightError instanceof Error
              ? preflightError.message
              : "Unable to check sale eligibility."
          );
        }
      })
      .finally(() => {
        if (requestId === requestSequence.current) setLoading(false);
      });
  }, [dogIdsKey, preflightRetry]);

  const eligibleDogs = useMemo(
    () => dogs.filter((dog) => eligibilityByDogId[dog.dogId]?.eligible),
    [dogs, eligibilityByDogId]
  );
  const invalidPriceDogIds = useMemo(
    () =>
      new Set(
        eligibleDogs
          .filter((dog) => !isValidWholeDollarSalePrice(pricesByDogId[dog.dogId] ?? ""))
          .map((dog) => dog.dogId)
      ),
    [eligibleDogs, pricesByDogId]
  );
  const formReady =
    !loading && !error && eligibleDogs.length > 0 && invalidPriceDogIds.size === 0;
  const sellAllPriceValid = isValidWholeDollarSalePrice(sellAllPrice);

  function applyPriceToEligibleDogs() {
    if (!sellAllPriceValid) return;
    setPricesByDogId((current) => ({
      ...current,
      ...Object.fromEntries(eligibleDogs.map((dog) => [dog.dogId, sellAllPrice])),
    }));
  }

  async function submitBulkSale() {
    if (!formReady || submitting || successMessage) return;
    setSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await fetch("/api/kennel/dogs/bulk-for-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: eligibleDogs.map((dog) => ({
            dogId: dog.dogId,
            askingPrice: pricesByDogId[dog.dogId],
          })),
        }),
      });
      const data = (await response.json()) as BulkSaleMutationResponse;
      if (!response.ok || !data.ok || typeof data.listedCount !== "number") {
        throw new Error(data.error || "No dogs were listed.");
      }
      await onSuccess({ listedCount: data.listedCount });
    } catch (mutationError) {
      setSubmissionError(
        mutationError instanceof Error
          ? mutationError.message
          : "No dogs were listed. Please review sale eligibility and try again."
      );
      setPreflightRetry((current) => current + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-4 min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4" aria-labelledby="bulk-for-sale-heading">
      <div className="flex flex-col gap-4">
        <div>
          <h2 id="bulk-for-sale-heading" className="theme-heading text-lg font-semibold">Bulk For Sale</h2>
          <p className="theme-copy mt-1 text-sm">Set an asking price for each eligible selected dog.</p>
        </div>

        <div className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-semibold">
            <span>Sell All For</span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true">$</span>
              <input type="text" inputMode="numeric" value={sellAllPrice} onChange={(event) => setSellAllPrice(event.target.value)} aria-label="Sell All For price" className="theme-control w-full rounded-lg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]" />
            </span>
          </label>
          <button type="button" onClick={applyPriceToEligibleDogs} disabled={loading || !sellAllPriceValid} className="theme-secondary-button rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-45">Apply to All</button>
        </div>
        {sellAllPrice && !sellAllPriceValid ? <p className="theme-status-danger rounded-lg px-3 py-2 text-sm" role="alert">Enter a whole-dollar price of at least $1.</p> : null}

        {loading ? <p className="theme-copy text-sm" role="status" aria-live="polite">Checking sale eligibility...</p> : null}
        {error ? <div className="theme-status-danger rounded-lg px-3 py-2 text-sm" role="alert">{error}</div> : null}
        {submissionError ? <div className="theme-status-danger rounded-lg px-3 py-2 text-sm" role="alert">{submissionError}</div> : null}
        {successMessage ? <div className="theme-status-success rounded-lg px-3 py-2 text-sm" role="status">{successMessage}</div> : null}

        <div className="grid gap-3">
          {dogs.map((dog) => {
            const eligibility = eligibilityByDogId[dog.dogId];
            const eligible = eligibility?.eligible === true;
            const price = pricesByDogId[dog.dogId] ?? "";
            const invalidPrice = eligible && invalidPriceDogIds.has(dog.dogId);
            const callName = dog.callName?.trim() && dog.callName.trim() !== dog.displayName ? dog.callName.trim() : null;
            return (
              <article key={dog.dogId} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,240px)] sm:items-end">
                  <div>
                    <h3 className="theme-heading font-semibold">{dog.displayName}</h3>
                    <p className="theme-copy mt-1 text-sm">{dog.regNumber} · {dog.ageLabel}{callName ? ` · Call name: ${callName}` : ""}</p>
                    {loading ? <p className="theme-copy mt-2 text-sm">Eligibility pending.</p> : eligible ? <p className="theme-status-success mt-2 inline-block rounded-md px-2 py-1 text-sm" role="status">Eligible</p> : eligibility ? <p className="theme-copy mt-2 text-sm" role="status">Not eligible — {eligibility.reasonMessage ?? "Eligibility could not be determined."}</p> : null}
                  </div>
                  <label className="grid gap-1 text-sm font-semibold">
                    <span>Sale price</span>
                    <span className="sr-only">for {dog.displayName}</span>
                    <input type="text" inputMode="numeric" value={price} onChange={(event) => setPricesByDogId((current) => ({ ...current, [dog.dogId]: event.target.value }))} disabled={loading || !eligible} aria-label={`Sale price for ${dog.displayName}`} aria-describedby={invalidPrice ? `sale-price-error-${dog.dogId}` : undefined} className="theme-control rounded-lg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-45" />
                    {invalidPrice && !loading ? <span id={`sale-price-error-${dog.dogId}`} className="theme-status-danger rounded-md px-2 py-1 text-xs" role="alert">Enter a whole-dollar price of at least $1.</span> : null}
                  </label>
                </div>
              </article>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="theme-copy text-sm" role="status">{successMessage ? "The submitted dogs are listed for sale." : formReady ? "Prices are complete. Ready to list eligible dogs for sale." : eligibleDogs.length === 0 && !loading && !error ? "No selected dogs are currently eligible for sale." : "Add a valid whole-dollar price for every eligible dog."}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onClose} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]">Cancel</button>
            <button type="button" onClick={submitBulkSale} disabled={!formReady || submitting || Boolean(successMessage)} className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45">{submitting ? "Listing dogs..." : "List Dogs For Sale"}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
