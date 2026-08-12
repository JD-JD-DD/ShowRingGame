"use client";

import { useState } from "react";

type GroomingJobAcceptanceFormProps = {
  action: string;
  dogDisplayName: string;
  disabled: boolean;
};

export default function GroomingJobAcceptanceForm({
  action,
  dogDisplayName,
  disabled,
}: GroomingJobAcceptanceFormProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div className="theme-card mt-4 rounded-xl p-4 text-sm">
        <p className="theme-copy">Accept the grooming job for {dogDisplayName}?</p>
        <form action={action} method="post" className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="returnTo" value="/kennel/services/grooming" />
          <button
            type="submit"
            className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
        </form>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "No grooming actions remaining this week." : undefined}
      onClick={() => setIsConfirming(true)}
      className="theme-primary-button mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
    >
      {disabled ? "No Grooming Left" : "Accept Grooming Job"}
    </button>
  );
}
