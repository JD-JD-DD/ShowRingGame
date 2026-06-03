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
        className="w-full rounded-2xl border border-sky-300/25 bg-sky-500/10 px-5 py-3 text-center text-sm font-semibold text-sky-100 transition hover:bg-sky-500/20"
      >
        Offer Dog At Stud
      </button>
    );
  }

  return (
    <form
      action={action}
      method="post"
      className="rounded-2xl border border-sky-300/20 bg-black/20 p-3"
    >
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100/80">
          Stud Fee
        </span>
        <input
          type="number"
          name="studFeeAmount"
          min={1}
          step={1}
          required
          inputMode="numeric"
          className="mt-2 w-full rounded-xl border border-sky-300/20 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-sky-100/35 focus:border-sky-300/50"
          placeholder="Whole dollars"
        />
      </label>

      <label className="mt-3 flex items-start gap-2 rounded-xl border border-sky-300/20 bg-sky-500/10 p-3 text-xs leading-5 text-sky-100/85">
        <input
          type="checkbox"
          name="requiresBrucellosisNegativeDam"
          className="mt-1"
        />
        <span>
          Require a valid negative brucellosis test for outside bitches.
        </span>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="submit"
          className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
        >
          List At Stud
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
