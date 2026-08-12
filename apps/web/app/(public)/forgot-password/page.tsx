"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [localResetUrl, setLocalResetUrl] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");
    setLocalResetUrl("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Unable to request a password reset.");
        return;
      }

      setMessage(data.message);
      setLocalResetUrl(data.resetUrl ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-3xl flex-col">
        <header className="theme-panel mb-8 flex flex-col gap-6 rounded-[28px] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="relative h-16 w-[250px] sm:h-20 sm:w-[320px]">
            <Image
              src="/logo.png"
              alt="ShowRing Game"
              fill
              className="object-contain object-left"
              priority
            />
          </Link>

          <Link
            href="/login"
            className="theme-secondary-button w-fit rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            Back to Login
          </Link>
        </header>

        <section className="theme-panel rounded-[32px] p-7 sm:p-8">
          <div className="theme-neutral-badge mb-4 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]">
            Account Recovery
          </div>

          <h1 className="theme-heading text-3xl font-bold sm:text-4xl">
            Reset your password.
          </h1>
          <p className="theme-copy mt-3 text-sm leading-6 sm:text-base">
            Enter the email address for your account. If it matches an account,
            we will send a reset link that expires in 60 minutes.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
            <label className="grid gap-2">
              <span className="theme-heading text-sm font-semibold">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="theme-control rounded-2xl px-4 py-3 outline-none"
              />
            </label>

            {message ? (
              <div className="theme-status-success rounded-2xl px-4 py-3 text-sm font-semibold">
                {message}
              </div>
            ) : null}

            {localResetUrl ? (
              <div className="theme-card theme-copy rounded-2xl px-4 py-3 text-sm leading-6">
                Local testing link:{" "}
                <Link
                  href={localResetUrl}
                  className="theme-accent-link font-semibold"
                >
                  reset password
                </Link>
              </div>
            ) : null}

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
              {isSubmitting ? "Requesting Link..." : "Send Reset Link"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
