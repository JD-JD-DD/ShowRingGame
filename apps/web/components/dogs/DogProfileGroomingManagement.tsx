import type { DogProfileGroomingDetailsDto } from "@/server/mappers/dog.mapper";

import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";

import CancelGroomingListingForm from "./CancelGroomingListingForm";

type Props = {
  dogId: string;
  dogName: string;
  grooming: DogProfileGroomingDetailsDto;
  returnTo: string;
  message: string | null;
  error: string | null;
};

export default function DogProfileGroomingManagement({
  dogId,
  dogName,
  grooming,
  returnTo,
  message,
  error,
}: Props) {
  return (
    <details className="group">
      <summary className="theme-secondary-button list-none rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        Manage Grooming
      </summary>
      <div className="dog-card mt-3 rounded-2xl p-4">
        <div className="dog-copy grid gap-2 text-sm">
          <div>
            Actions remaining: {grooming.weeklyActionsRemaining} / {grooming.weeklyActionLimit}
          </div>
          <div>Coat condition: {grooming.currentCoatCondition.toFixed(2)}</div>
          <div>
            Net effect: {grooming.netGroomingEffect >= 0 ? "+" : ""}
            {grooming.netGroomingEffect.toFixed(2)}
          </div>
          <div>Status: {grooming.groomingStatus}</div>
        </div>
        {message ? <div className="theme-notice theme-notice--success mt-3 rounded-xl px-4 py-3 text-sm">{message}</div> : null}
        {error ? <div className="theme-notice theme-notice--danger mt-3 rounded-xl px-4 py-3 text-sm">{error}</div> : null}
        <div className="mt-3 grid gap-2">
          {grooming.canCancelOutsideGrooming && grooming.outsideGroomingListingId ? (
            <CancelGroomingListingForm
              action={`/api/services/grooming/listings/${grooming.outsideGroomingListingId}/cancel`}
              dogName={dogName}
            />
          ) : (
            <>
              <form action="/api/services/grooming/self-groom" method="post">
                <input type="hidden" name="dogId" value={dogId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button
                  type="submit"
                  disabled={!grooming.canGroom}
                  className="theme-primary-button w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Confirm Groom Dog
                </button>
              </form>
              <form action="/api/services/grooming/list" method="post">
                <input type="hidden" name="dogId" value={dogId} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmSubmitButton
                  message={`Offer ${dogName} for outside grooming?`}
                  disabled={!grooming.canOfferOutsideGrooming}
                  className="theme-secondary-button w-full rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Offer for Outside Grooming
                </ConfirmSubmitButton>
              </form>
            </>
          )}
        </div>
      </div>
    </details>
  );
}
