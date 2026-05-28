"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Login failed.");
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
    <main style={{ padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Login</h1>
      <p>Sign in to your ShowRing Game account.</p>
      <p style={{ marginTop: "12px" }}>
        Need an account?{" "}
        <Link href="/signup" style={{ fontWeight: 700, textDecoration: "underline" }}>
          Create one
        </Link>
        .
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: "16px",
          marginTop: "24px"
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
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "10px" }}
          />
        </label>

        {error && (
          <div style={{ color: "red", fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: "12px",
            cursor: isSubmitting ? "not-allowed" : "pointer"
          }}
        >
          {isSubmitting ? "Signing In..." : "Login"}
        </button>
      </form>
    </main>
  );
}
