"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          displayName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to create account.");
        setIsSubmitting(false);
        return;
      }

      router.push(data.nextPath ?? "/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setIsSubmitting(false);
    }
  }

  return (
    <main style={{ padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Create Account</h1>
      <p>Sign up for ShowRing Game.</p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "16px",
          marginTop: "24px",
        }}
      >
        <label style={{ display: "grid", gap: "6px" }}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "10px" }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span>Display Name (optional)</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{ padding: "10px" }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "10px" }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span>Confirm Password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            style={{ padding: "10px" }}
          />
        </label>

        {error ? (
          <div style={{ color: "red", fontWeight: 600 }}>{error}</div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: "12px",
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          {isSubmitting ? "Creating Account..." : "Create Account"}
        </button>
      </form>
    </main>
  );
}
