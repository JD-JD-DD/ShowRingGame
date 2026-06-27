"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const loginHighlights = [
  "Check your kennel, litters, show entries, and notices.",
  "Follow results, title progress, and dogs at stud.",
  "Keep building your line one careful choice at a time.",
];

export default function LoginPage() {
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

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const safeRequestedPath =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : null;

      window.location.assign(safeRequestedPath ?? data.nextPath ?? "/kennel");

    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col">
        <header className="theme-panel mb-8 flex flex-col gap-6 rounded-[28px] px-6 py-5 backdrop-blur md:flex-row md:items-center md:justify-between">
          <Link href="/" className="relative h-16 w-[250px] sm:h-20 sm:w-[320px]">
            <Image
              src="/logo.png"
              alt="ShowRing Game"
              fill
              className="object-contain object-left"
              priority
            />
          </Link>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/signup"
              className="theme-secondary-button rounded-full px-5 py-2.5 font-semibold"
            >
              Create Account
            </Link>
            <Link
              href="/"
              className="rounded-full bg-purple-600 px-5 py-2.5 font-semibold text-white transition hover:bg-purple-500"
            >
              Home
            </Link>
          </nav>
        </header>

        <section className="theme-panel rounded-[32px] p-7 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="theme-neutral-badge mb-4 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]">
                Player Login
              </div>

              <h1 className="theme-heading max-w-3xl text-4xl font-bold sm:text-5xl lg:text-6xl">
                Welcome back to the ring.
              </h1>

              <p className="theme-copy mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">
                Sign in to manage your kennel, plan breedings, enter shows, and
                keep an eye on the dogs carrying your name forward.
              </p>

              <div className="mt-7 grid gap-3">
                {loginHighlights.map((item) => (
                  <div
                    key={item}
                    className="theme-card theme-copy rounded-2xl px-4 py-3 text-sm leading-6"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="theme-card rounded-[24px] p-5 sm:p-6">
              <h2 className="theme-heading text-2xl font-semibold">Log in</h2>
              <div className="theme-card mt-4 rounded-2xl px-4 py-4">
                <p className="theme-heading text-sm font-semibold">
                  New to ShowRing Game?
                </p>
                <Link
                  href="/signup"
                  className="mt-3 inline-flex w-full justify-center rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                  Create your kennel account
                </Link>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="theme-label text-sm font-semibold">
                    Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="theme-control rounded-2xl px-4 py-3 outline-none transition focus:border-[var(--dog-border)]"
                    autoComplete="email"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="theme-label flex items-center justify-between gap-3 text-sm font-semibold">
                    <span>Password</span>
                    <Link
                      href="/forgot-password"
                      className="theme-label text-xs underline decoration-purple-300/60 underline-offset-4 transition hover:opacity-80"
                    >
                      Forgot password?
                    </Link>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="theme-control rounded-2xl px-4 py-3 outline-none transition focus:border-[var(--dog-border)]"
                    autoComplete="current-password"
                  />
                </label>

                {error ? (
                  <div className="rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 rounded-2xl bg-purple-600 px-5 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Signing In..." : "Login"}
                </button>
              </form>

              <div className="theme-card theme-copy mt-5 rounded-2xl px-4 py-3 text-sm leading-6">
                No dog-show background required. The game gives you visible
                category summaries and room to learn as your kennel grows.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
