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
        className="w-full rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
      >
        Cancel Grooming Listing
      </button>
    );
  }

  return (
    <form
      onSubmit={cancelListing}
      className="rounded-xl border border-red-300/25 bg-red-500/10 p-3"
    >
      <div className="text-sm font-semibold text-red-100">
        Cancel outside grooming listing?
      </div>
      <p className="mt-1 text-xs leading-5 text-red-100/75">
        Cancel the outside grooming listing for {dogName}?
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-red-300/25 bg-red-950/35 px-3 py-2 text-xs text-red-100"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45"
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
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Keep Listing
        </button>
      </div>
    </form>
  );
}
