"use client";

import { useState } from "react";

type ManageDogStudListingFormProps = {
  dogId: string;
  listingId: string;
  currentPrice: number;
  updateAction: string;
  cancelAction: string;
};

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export default function ManageDogStudListingForm({
  dogId,
  listingId,
  currentPrice,
  updateAction,
  cancelAction,
}: ManageDogStudListingFormProps) {
  const [isEditing, setIsEditing] = useState(false);

  function confirmCancel(event: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "Cancel this stud listing? The dog will be removed from stud availability."
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <div className="rounded-2xl border border-sky-300/20 bg-black/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100/80">
        Listed At Stud
      </div>
      <div className="mt-1 text-sm font-semibold text-white">
        {formatMoney(currentPrice)}
      </div>

      {!isEditing ? (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="mt-3 w-full rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
        >
          Edit Stud Fee
        </button>
      ) : null}

      {isEditing ? (
        <>
          <form action={updateAction} method="post" className="mt-3">
            <input type="hidden" name="dogId" value={dogId} />
            <input type="hidden" name="listingId" value={listingId} />
            <input
              type="number"
              name="studFeeAmount"
              min={1}
              step={1}
              required
              inputMode="numeric"
              defaultValue={currentPrice}
              className="w-full rounded-xl border border-sky-300/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
            />
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Update Stud Fee
            </button>
          </form>

          <form action={cancelAction} method="post" onSubmit={confirmCancel}>
            <input type="hidden" name="dogId" value={dogId} />
            <input type="hidden" name="listingId" value={listingId} />
            <button
              type="submit"
              className="mt-2 w-full rounded-xl border border-red-300/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
            >
              Cancel Stud Listing
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
