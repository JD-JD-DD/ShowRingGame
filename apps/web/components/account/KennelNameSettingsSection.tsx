"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  currentName: string;
  currentSlug: string;
  previousName: string | null;
  hasUsedSelfServiceRename: boolean;
  initialSuccess: boolean;
};

const confirmationLabel =
  "This self-service kennel name change can only be used once. Your former kennel name will remain visible on your public kennel profile.";

export default function KennelNameSettingsSection({
  currentName,
  currentSlug,
  previousName,
  hasUsedSelfServiceRename,
  initialSuccess,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(initialSuccess);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/kennel/rename", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to rename kennel.");
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      router.push(data.nextPath ?? "/account?renamed=1");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to rename kennel."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <section className="theme-card rounded-2xl p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">
            Kennel Name
          </div>
          <h2 className="theme-heading mt-2 text-2xl font-semibold">
            {currentName}
          </h2>
          <p className="theme-copy mt-2 text-sm">
            Public profile:{" "}
            <Link
              href={`/kennels/${currentSlug}`}
              className="theme-accent-link font-semibold"
            >
              /kennels/{currentSlug}
            </Link>
          </p>
          {previousName ? (
            <p className="theme-copy mt-2 text-sm">
              Previously known as: <span className="theme-heading font-semibold">{previousName}</span>
            </p>
          ) : null}
        </div>
      </div>

      {success ? (
        <p className="theme-status-success mt-4 rounded-2xl px-4 py-3 text-sm font-medium">
          Kennel name updated successfully.
        </p>
      ) : null}

      {hasUsedSelfServiceRename ? (
        <div className="theme-card theme-copy mt-5 rounded-2xl px-4 py-4 text-sm">
          <p className="theme-heading font-semibold">
            Self-service kennel renaming has already been used.
          </p>
          <p className="mt-2">
            If you need an exceptional privacy, harassment, legal, or correction
            review, contact an administrator.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
          <p className="theme-copy text-sm">
            You can change your kennel name once through self-service. Your
            former kennel name will remain visible on your public kennel
            profile.
          </p>

          <label className="grid gap-2">
            <span className="theme-heading text-sm font-semibold">New kennel name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={45}
              required
              className="theme-control rounded-xl px-3 py-2"
              placeholder="Enter your new kennel name"
            />
          </label>

          <label className="theme-status-warning flex items-start gap-3 rounded-2xl px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>{confirmationLabel}</span>
          </label>

          {error ? (
            <p className="theme-status-danger rounded-2xl px-4 py-3 text-sm font-medium">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !confirmed}
              className="theme-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Confirm kennel name change"}
            </button>
            <p className="theme-copy text-xs">
              One self-service rename per kennel.
            </p>
          </div>
        </form>
      )}
    </section>
  );
}
