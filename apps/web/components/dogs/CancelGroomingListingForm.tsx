"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type CancelGroomingListingFormProps = {
  action: string;
  dogName: string;
};

type CancelResponse = {
  error?: string;
  message?: string;
};

export default function CancelGroomingListingForm({
  action,
  dogName,
}: CancelGroomingListingFormProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancelListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const result = (await response.json().catch(() => ({}))) as CancelResponse;

      if (!response.ok) {
        setError(result.error ?? "Could not cancel the grooming listing.");
        return;
      }

      setIsConfirming(false);
      router.refresh();
    } catch {
      setError("Could not cancel the grooming listing. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsConfirming(true);
        }}
        className="theme-status-danger w-full rounded-xl px-4 py-2 text-sm font-semibold"
      >
        Cancel Grooming Listing
      </button>
    );
  }

  return (
    <form
      onSubmit={cancelListing}
      className="theme-status-danger rounded-xl p-3"
    >
      <div className="text-sm font-semibold">
        Cancel outside grooming listing?
      </div>
      <p className="mt-1 text-xs leading-5">
        Cancel the outside grooming listing for {dogName}?
      </p>

      {error ? (
        <p
          role="alert"
          className="theme-status-danger mt-2 rounded-lg px-3 py-2 text-xs"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="submit"
          disabled={isPending}
          className="theme-status-danger rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isPending ? "Canceling..." : "Yes, Cancel Listing"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsConfirming(false);
          }}
          disabled={isPending}
          className="dog-secondary-button rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
        >
          Keep Listing
        </button>
      </div>
    </form>
  );
}
