"use client";

import { useState } from "react";

type OfferDogAtStudFormProps = {
  action: string;
};

export default function OfferDogAtStudForm({
  action,
}: OfferDogAtStudFormProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="theme-secondary-button w-full rounded-2xl px-5 py-3 text-center text-sm font-semibold"
      >
        Offer Dog At Stud
      </button>
    );
  }

  return (
    <form
      action={action}
      method="post"
      className="dog-card rounded-2xl p-3"
    >
      <label className="block">
        <span className="dog-label text-xs font-semibold uppercase tracking-[0.16em]">
          Stud Fee
        </span>
        <input
          type="number"
          name="studFeeAmount"
          min={1}
          step={1}
          required
          inputMode="numeric"
          className="dog-control mt-2 w-full rounded-xl px-3 py-2 text-sm outline-none"
          placeholder="Whole dollars"
        />
      </label>

      <label className="theme-status-info mt-3 flex items-start gap-2 rounded-xl p-3 text-xs leading-5">
        <input
          type="checkbox"
          name="requiresBrucellosisNegativeDam"
          className="mt-1"
        />
        <span>
          Require a valid negative brucellosis test for outside bitches.
        </span>
      </label>

      <div className="dog-card mt-3 rounded-xl p-3">
        <div className="dog-label text-xs font-semibold uppercase tracking-[0.16em]">
          Minimum Bitch Requirements
        </div>
        <div className="dog-copy mt-3 grid gap-2 text-xs leading-5">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="requiresDamHealthTestsCompleted"
              className="mt-1"
            />
            <span>All required health tests completed.</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="requiresDamHealthAllGreen"
              className="mt-1"
            />
            <span>All health test results must be green.</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="requiresDamHealthGreenOrYellow"
              className="mt-1"
            />
            <span>Health test results may be green or yellow, but not red.</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              name="requiresDamChampionTitle"
              className="mt-1"
            />
            <span>Bitch must be a finished champion.</span>
          </label>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="submit"
          className="theme-primary-button rounded-xl px-3 py-2 text-sm font-semibold"
        >
          List At Stud
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="dog-secondary-button rounded-xl px-3 py-2 text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
