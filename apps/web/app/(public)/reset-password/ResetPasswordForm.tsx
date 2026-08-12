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
      <div className="theme-status-danger rounded-2xl px-4 py-3 text-sm font-semibold">
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
        <div className="theme-status-success rounded-2xl px-4 py-3 text-sm font-semibold">
          {message}
        </div>
        <Link
          href="/login"
          className="theme-primary-button rounded-2xl px-5 py-3 text-center font-semibold"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2">
        <span className="theme-heading text-sm font-semibold">
          New Password
        </span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="theme-control rounded-2xl px-4 py-3 outline-none"
        />
      </label>

      <label className="grid gap-2">
        <span className="theme-heading text-sm font-semibold">
          Confirm New Password
        </span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="theme-control rounded-2xl px-4 py-3 outline-none"
        />
      </label>

      {error ? (
        <div className="theme-status-danger rounded-2xl px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="theme-primary-button mt-2 rounded-2xl px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Updating Password..." : "Reset Password"}
      </button>
    </form>
  );
}
