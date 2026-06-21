"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type ManageDogStudListingFormProps = {
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

function CancelStudListingSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {pending ? "Canceling..." : "Yes, Cancel Listing"}
    </button>
  );
}

export default function ManageDogStudListingForm({
  dogId,
  listingId,
  currentPrice,
  updateAction,
  cancelAction,
  areaId,
}: ManageDogStudListingFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  return (
    <div className="dog-card rounded-2xl p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100/80">
        Listed At Stud
      </div>
      <div className="dog-heading mt-1 text-sm font-semibold">
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
            {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
            <input
              type="number"
              name="studFeeAmount"
              min={1}
              step={1}
              required
              inputMode="numeric"
              defaultValue={currentPrice}
              className="dog-control w-full rounded-xl px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Update Stud Fee
            </button>
          </form>

          {isConfirmingCancel ? (
            <div className="mt-3 rounded-xl border border-red-300/25 bg-red-500/10 p-3">
              <div className="text-sm font-semibold text-red-100">
                Cancel this stud listing?
              </div>
              <p className="mt-1 text-xs leading-5 text-red-100/75">
                The dog will be removed from stud availability.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <form action={cancelAction} method="post">
                  <input type="hidden" name="dogId" value={dogId} />
                  <input type="hidden" name="listingId" value={listingId} />
                  {areaId ? (
                    <input type="hidden" name="areaId" value={areaId} />
                  ) : null}
                  <CancelStudListingSubmitButton />
                </form>
                <button
                  type="button"
                  onClick={() => setIsConfirmingCancel(false)}
                  className="dog-secondary-button rounded-xl px-3 py-2 text-sm font-semibold"
                >
                  Keep Listing
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingCancel(true)}
              className="mt-2 w-full rounded-xl border border-red-300/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
            >
              Cancel Stud Listing
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
