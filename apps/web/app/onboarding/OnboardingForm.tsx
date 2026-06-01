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
    <main style={{ padding: "40px", maxWidth: "700px", margin: "0 auto" }}>
      <h1>Create Your Kennel</h1>
      <p>Your account is ready. Now create your kennel to enter the game.</p>
      <p>Your home region will be assigned automatically to keep region populations balanced.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px", marginTop: "24px" }}>
        <label style={{ display: "grid", gap: "8px" }}>
          <span>Kennel Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={45}
            placeholder="Show Ring Game"
            required
            style={{ padding: "10px" }}
          />
        </label>

        <label style={{ display: "grid", gap: "8px" }}>
          <span>Public Slogan (optional)</span>
          <input
            value={publicSlogan}
            onChange={(e) => setPublicSlogan(e.target.value)}
            placeholder="Built for the purple"
            maxLength={75}
            style={{ padding: "10px" }}
          />
        </label>

        {error ? <div style={{ color: "red", fontWeight: 600 }}>{error}</div> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: "12px 16px",
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          {isSubmitting ? "Creating Kennel..." : "Create Kennel"}
        </button>
      </form>
    </main>
  );
}
