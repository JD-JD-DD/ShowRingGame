"use client";

import { useState } from "react";

type RegisterDogNameFormProps = {
  action: string;
  areaId?: string | null;
  nameError: string | null;
};

export default function RegisterDogNameForm({
  action,
  areaId,
  nameError,
}: RegisterDogNameFormProps) {
  const [confirmingName, setConfirmingName] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const registeredName = String(formData.get("registeredName") ?? "").trim();

    if (confirmingName !== registeredName) {
      event.preventDefault();
      setConfirmingName(registeredName);
    }
  }

  return (
    <form
      action={action}
      method="post"
      onSubmit={handleSubmit}
      className="dog-card mt-5 flex max-w-xl flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {areaId ? <input type="hidden" name="areaId" value={areaId} /> : null}
      <label className="min-w-0 flex-1">
        <span className="dog-label text-xs font-semibold uppercase tracking-[0.16em]">
          Registered Name
        </span>
        <input
          type="text"
          name="registeredName"
          defaultValue=""
          maxLength={45}
          required
          onChange={() => setConfirmingName(null)}
          className="dog-control mt-2 w-full rounded-xl px-3 py-2 text-sm outline-none placeholder:text-purple-400/60 focus:border-purple-400"
          placeholder="Register Your Dog's Name"
        />
      </label>
      {!confirmingName ? (
        <button
          type="submit"
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
        >
          Save Name
        </button>
      ) : null}
      {nameError ? (
        <div className="basis-full text-sm text-rose-200">{nameError}</div>
      ) : null}
      {confirmingName ? (
        <div className="basis-full rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-red-100">
            Confirm registered name.
          </div>
          <div className="mt-1 text-sm leading-6 text-red-100/75">
            Register &quot;{confirmingName}&quot; as this dog&apos;s permanent
            profile name? Registered names cannot be changed after confirmation.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              Confirm Name
            </button>
            <button
              type="button"
              onClick={() => setConfirmingName(null)}
              className="dog-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
