"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DogProfileEmergencyCareDto } from "@/server/mappers/dog.mapper";

type ConfirmationMode = "treat" | "decline" | null;

type Props = {
  dogId: string;
  dogName: string;
  emergency: DogProfileEmergencyCareDto;
  className?: string;
};

export default function EmergencyVetCarePanel({
  dogId,
  dogName,
  emergency,
  className,
}: Props) {
  const router = useRouter();
  const [confirmationMode, setConfirmationMode] =
    useState<ConfirmationMode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitEmergencyAction(action: "treat" | "decline") {
    setIsSubmitting(true);
    setError(null);

    try {
      const actionUrl =
        action === "treat"
          ? `/api/dogs/${dogId}/emergency-care/treat`
          : `/api/dogs/${dogId}/emergency-care/decline`;
      const response = await fetch(actionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Emergency care action failed.");
      }

      setConfirmationMode(null);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Emergency care action failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className={`${className ?? ""} border border-red-500/30 bg-red-500/10`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="dog-label text-xs uppercase tracking-wide text-red-700 dark:text-red-200">
            Pending decision
          </p>
          <h2 className="dog-heading mt-1 text-2xl font-bold">
            Emergency Vet Care Required
          </h2>
        </div>
        <div className="rounded-2xl border border-red-400/30 bg-white/70 px-4 py-2 text-sm font-bold text-red-800 shadow-sm dark:bg-black/20 dark:text-red-100">
          Deadline: {emergency.deadlineLabel}
        </div>
      </div>

      <p className="dog-copy mt-4 max-w-4xl text-sm leading-6">
        {dogName} has a serious medical emergency. Emergency treatment costs{" "}
        <strong>{emergency.treatmentCostLabel}</strong>. With treatment, the
        estimated survival chance is{" "}
        <strong>{emergency.survivalChanceLabel}</strong>. Treatment is not
        guaranteed. If you decline care or do not respond before the deadline,{" "}
        {dogName} will die.
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-100">
          {error}
        </div>
      ) : null}

      {confirmationMode ? (
        <div className="mt-5 rounded-2xl border border-red-400/30 bg-white/75 p-4 dark:bg-black/20">
          <h3 className="dog-heading text-lg font-semibold">
            {confirmationMode === "treat"
              ? "Authorize Treatment"
              : "Decline Care"}
          </h3>
          <p className="dog-copy mt-2 text-sm leading-6">
            {confirmationMode === "treat"
              ? `Treatment will cost ${emergency.treatmentCostLabel}. The estimated survival chance with treatment is ${emergency.survivalChanceLabel}.`
              : `Declining care will result in ${dogName}'s death. This cannot be undone.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => submitEmergencyAction(confirmationMode)}
              disabled={isSubmitting}
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Submitting..."
                : confirmationMode === "treat"
                  ? "Confirm Treatment"
                  : "Decline Care"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmationMode(null);
                setError(null);
              }}
              disabled={isSubmitting}
              className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Keep Deciding
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setConfirmationMode("treat")}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-red-800"
          >
            Authorize Treatment
          </button>
          <button
            type="button"
            onClick={() => setConfirmationMode("decline")}
            className="rounded-xl border border-red-500/40 bg-white/75 px-4 py-2 text-sm font-bold text-red-800 transition hover:bg-red-50 dark:bg-black/20 dark:text-red-100 dark:hover:bg-red-950/40"
          >
            Decline Care
          </button>
        </div>
      )}
    </section>
  );
}
