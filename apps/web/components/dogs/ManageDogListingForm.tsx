"use client";

import { useState } from "react";

type ManageDogListingFormProps = {
  dogId: string;
  listingId: string;
  currentPrice: number;
  updateAction: string;
  cancelAction: string;
  areaId?: string | null;
};

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export default function ManageDogListingForm({
  dogId,
  listingId,
  currentPrice,
  updateAction,
  cancelAction,
  areaId,
}: ManageDogListingFormProps) {
  const [isEditing, setIsEditing] = useState(false);

  function confirmCancel(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "Cancel this sale listing? The dog will be removed from the market."
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-black/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/80">
        Listed For Sale
      </div>
      <div className="mt-1 text-sm font-semibold text-white">
        {formatMoney(currentPrice)}
      </div>

      {!isEditing ? (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="mt-3 w-full rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
        >
          Edit Sale
        </button>
      ) : null}

      {isEditing ? (
        <>
          <form action={updateAction} method="post" className="mt-3">
            <input type="hidden" name="dogId" value={dogId} />
            <input type="hidden" name="listingId" value={listingId} />
            {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
            <input
              type="number"
              name="askingPrice"
              min={1}
              step={1}
              required
              inputMode="numeric"
              defaultValue={currentPrice}
              className="w-full rounded-xl border border-emerald-300/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
            />
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Update Price
            </button>
          </form>

          <form action={cancelAction} method="post" onSubmit={confirmCancel}>
            <input type="hidden" name="dogId" value={dogId} />
            <input type="hidden" name="listingId" value={listingId} />
            {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
            <button
              type="submit"
              className="mt-2 w-full rounded-xl border border-red-300/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
            >
              Cancel Listing
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
