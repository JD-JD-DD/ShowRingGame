"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

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

function CancelStudListingSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="theme-status-danger rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
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
}: ManageDogStudListingFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  return (
    <div className="dog-card rounded-2xl p-3">
      <div className="dog-label text-xs font-semibold uppercase tracking-[0.16em]">
        Listed At Stud
      </div>
      <div className="dog-heading mt-1 text-sm font-semibold">
        {formatMoney(currentPrice)}
      </div>

      {!isEditing ? (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="theme-secondary-button mt-3 w-full rounded-xl px-3 py-2 text-sm font-semibold"
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
              className="dog-control w-full rounded-xl px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="theme-primary-button mt-2 w-full rounded-xl px-3 py-2 text-sm font-semibold"
            >
              Update Stud Fee
            </button>
          </form>

          {isConfirmingCancel ? (
            <div className="theme-status-danger mt-3 rounded-xl p-3">
              <div className="text-sm font-semibold">
                Cancel this stud listing?
              </div>
              <p className="mt-1 text-xs leading-5">
                The dog will be removed from stud availability.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <form action={cancelAction} method="post">
                  <input type="hidden" name="dogId" value={dogId} />
                  <input type="hidden" name="listingId" value={listingId} />
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
              className="theme-status-danger mt-2 w-full rounded-xl px-3 py-2 text-sm font-semibold"
            >
              Cancel Stud Listing
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
