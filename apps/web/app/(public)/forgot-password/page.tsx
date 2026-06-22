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
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto flex max-w-3xl flex-col">
        <header className="mb-8 flex flex-col gap-6 rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] px-6 py-5 shadow-[var(--dog-shadow)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
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
            className="w-fit rounded-full border border-[var(--dog-border)] bg-[var(--dog-card)] px-5 py-2.5 text-sm font-semibold text-[var(--dog-heading)] transition hover:bg-[var(--dog-card)]"
          >
            Back to Login
          </Link>
        </header>

        <section className="rounded-[32px] border border-[var(--dog-border)] bg-[var(--dog-panel)] p-7 shadow-[var(--dog-shadow)] sm:p-8">
          <div className="mb-4 inline-flex rounded-full border border-[var(--dog-border)] bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--dog-label)]">
            Account Recovery
          </div>

          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Reset your password.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--dog-copy)] sm:text-base">
            Enter the email address for your account. If it matches an account,
            we will send a reset link that expires in 60 minutes.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[var(--dog-heading)]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-control)] px-4 py-3 text-white outline-none transition placeholder:text-[var(--dog-copy)] focus:border-[var(--dog-border)] focus:bg-[var(--dog-control)]"
              />
            </label>

            {message ? (
              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-950/35 px-4 py-3 text-sm font-semibold text-emerald-100">
                {message}
              </div>
            ) : null}

            {localResetUrl ? (
              <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3 text-sm leading-6 text-[var(--dog-copy)]">
                Local testing link:{" "}
                <Link
                  href={localResetUrl}
                  className="font-semibold text-[var(--dog-heading)] underline decoration-purple-300/60 underline-offset-4"
                >
                  reset password
                </Link>
              </div>
            ) : null}

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
              {isSubmitting ? "Requesting Link..." : "Send Reset Link"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
