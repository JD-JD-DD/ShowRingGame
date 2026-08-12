"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [publicSlogan, setPublicSlogan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/kennel/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          publicSlogan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to create kennel.");
        setIsSubmitting(false);
        return;
      }

      router.push(data.nextPath ?? "/kennel");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <section className="theme-panel rounded-[28px] p-6">
      <h1 className="theme-heading text-3xl font-bold">Create Your Kennel</h1>
      <p className="theme-copy mt-3">Your account is ready. Now create your kennel to enter the game.</p>
      <p className="theme-copy mt-2">Your home region will be assigned automatically to keep region populations balanced.</p>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <label className="theme-heading grid gap-2">
          <span>Kennel Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={45}
            placeholder="Show Ring Game"
            required
            className="theme-control rounded-xl px-3 py-2.5"
          />
        </label>

        <label className="theme-heading grid gap-2">
          <span>Public Slogan (optional)</span>
          <input
            value={publicSlogan}
            onChange={(e) => setPublicSlogan(e.target.value)}
            placeholder="Built for the purple"
            maxLength={75}
            className="theme-control rounded-xl px-3 py-2.5"
          />
        </label>

        {error ? <div className="theme-status-danger rounded-xl px-4 py-3 font-semibold">{error}</div> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="theme-primary-button rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Creating Kennel..." : "Create Kennel"}
        </button>
      </form>
      </section>
    </main>
  );
}
