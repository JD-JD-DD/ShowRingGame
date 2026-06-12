"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type RehomeDogFormProps = {
  action: string;
  dogName: string;
  payout: number;
  areaId?: string | null;
};

function RehomeSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {pending ? "Re-Homing..." : "Yes, Re-Home Dog"}
    </button>
  );
}

export default function RehomeDogForm({
  action,
  areaId,
}: RehomeDogFormProps) {
  const [isConfirmingRehome, setIsConfirmingRehome] = useState(false);

  if (isConfirmingRehome) {
    return (
      <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-3">
        <div className="text-sm font-semibold text-red-100">
          Re-home this dog?
        </div>
        <p className="mt-1 text-xs leading-5 text-red-100/75">
          This cannot be undone. The dog will leave your kennel and you will no
          longer be able to use it.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <form action={action} method="post">
            {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
            <RehomeSubmitButton />
          </form>
          <button
            type="button"
            onClick={() => setIsConfirmingRehome(false)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Keep Dog
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsConfirmingRehome(true)}
      className="w-full rounded-2xl border border-red-300/25 bg-red-500/10 px-5 py-3 text-center text-sm font-semibold text-red-100 transition hover:bg-red-500/20"
    >
      Re-Home Dog
    </button>
  );
}
