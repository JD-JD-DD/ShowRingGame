"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to reset password.");
        return;
      }

      setMessage(data.message);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-red-300/30 bg-red-950/35 px-4 py-3 text-sm font-semibold text-red-100">
        This password reset link is invalid or has expired.{" "}
        <Link
          href="/forgot-password"
          className="underline decoration-red-200/60 underline-offset-4"
        >
          Request another link.
        </Link>
      </div>
    );
  }

  if (message) {
    return (
      <div className="grid gap-4">
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-950/35 px-4 py-3 text-sm font-semibold text-emerald-100">
          {message}
        </div>
        <Link
          href="/login"
          className="rounded-2xl bg-purple-600 px-5 py-3 text-center font-semibold text-white transition hover:bg-purple-500"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-purple-100">
          New Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-2xl border border-purple-300/20 bg-[#15091f] px-4 py-3 text-white outline-none transition placeholder:text-purple-100/35 focus:border-purple-300/55 focus:bg-[#1b0d27]"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-purple-100">
          Confirm New Password
        </span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-2xl border border-purple-300/20 bg-[#15091f] px-4 py-3 text-white outline-none transition placeholder:text-purple-100/35 focus:border-purple-300/55 focus:bg-[#1b0d27]"
        />
      </label>

      {error ? (
        <div className="rounded-2xl border border-red-300/30 bg-red-950/35 px-4 py-3 text-sm font-semibold text-red-100">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-2xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Updating Password..." : "Reset Password"}
      </button>
    </form>
  );
}
