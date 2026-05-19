"use client";

type RegisterDogNameFormProps = {
  action: string;
  nameError: string | null;
};

export default function RegisterDogNameForm({
  action,
  nameError,
}: RegisterDogNameFormProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const registeredName = String(formData.get("registeredName") ?? "").trim();

    const confirmed = window.confirm(
      `Register "${registeredName}" as this dog's permanent profile name?\n\nRegistered names cannot be changed after confirmation.`
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={action}
      method="post"
      onSubmit={handleSubmit}
      className="mt-5 flex max-w-xl flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="min-w-0 flex-1">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-200">
          Registered Name
        </span>
        <input
          type="text"
          name="registeredName"
          defaultValue=""
          maxLength={45}
          required
          className="mt-2 w-full rounded-xl border border-purple-300/20 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-purple-100/35 focus:border-purple-300/50"
          placeholder="Register Your Dog's Name"
        />
      </label>
      <button
        type="submit"
        className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500"
      >
        Save Name
      </button>
      {nameError ? (
        <div className="basis-full text-sm text-rose-200">{nameError}</div>
      ) : null}
    </form>
  );
}
