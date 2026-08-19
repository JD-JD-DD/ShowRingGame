"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  action: string;
  isBreedingActive: boolean;
};

export default function BreedingActiveControl({
  action,
  isBreedingActive,
}: Props) {
  const router = useRouter();
  const errorId = useId();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setBreedingActive(nextValue: boolean) {
    if (isPending || nextValue === isBreedingActive) return;

    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBreedingActive: nextValue }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to update breeding participation.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unable to update breeding participation.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div
      role="group"
      aria-label="Breeding"
      aria-busy={isPending || undefined}
      aria-describedby={error ? errorId : undefined}
      className="dog-card rounded-2xl px-4 py-3"
    >
      <div className="dog-label mb-2 text-xs font-semibold uppercase tracking-wide">
        Breeding
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--color-border)] p-1">
        <button
          type="button"
          aria-pressed={isBreedingActive}
          disabled={isPending}
          onClick={() => setBreedingActive(true)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
            isBreedingActive
              ? "theme-primary-button"
              : "dog-secondary-button"
          }`}
        >
          Active
        </button>
        <button
          type="button"
          aria-pressed={!isBreedingActive}
          disabled={isPending}
          onClick={() => setBreedingActive(false)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60 ${
            !isBreedingActive
              ? "theme-primary-button"
              : "dog-secondary-button"
          }`}
        >
          Inactive
        </button>
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="theme-status-danger mt-2 rounded-lg px-3 py-2 text-xs"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
