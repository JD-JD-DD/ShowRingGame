"use client";

import { useState } from "react";

type OfferDogForSaleFormProps = {
  action: string;
};

export default function OfferDogForSaleForm({
  action,
}: OfferDogForSaleFormProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-5 py-3 text-center text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
      >
        Offer Dog For Sale
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
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/80">
          Asking Price
        </span>
        <input
          type="number"
          name="askingPrice"
          min={1}
          step={1}
          required
          inputMode="numeric"
          className="dog-control mt-2 w-full rounded-xl px-3 py-2 text-sm outline-none placeholder:text-purple-400/60 focus:border-emerald-400"
          placeholder="Whole dollars"
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="submit"
          className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          List Dog
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
