"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const signupHighlights = [
  {
    title: "Start With Foundation Dogs",
    body: "Choose released breeds, compare directional visible categories, and build a kennel with a plan.",
  },
  {
    title: "Breed For The Next Generation",
    body: "Pair compatible dogs, follow pregnancy timing, and evaluate each litter as it grows.",
  },
  {
    title: "Step Into The Show Ring",
    body: "Enter eligible dogs, watch results, earn titles, and chase wins against other kennels.",
  },
];

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
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col">
        <header className="theme-panel mb-8 flex flex-col gap-6 rounded-[28px] px-6 py-5 md:flex-row md:items-center md:justify-between">
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
              href="/login"
              className="theme-secondary-button rounded-full px-5 py-2.5 font-semibold"
            >
              Log In
            </Link>
            <Link
              href="/"
              className="theme-primary-button rounded-full px-5 py-2.5 font-semibold"
            >
              Home
            </Link>
          </nav>
        </header>

        <section className="theme-panel rounded-[32px] p-7 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="theme-neutral-badge mb-4 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]">
                New Kennel
              </div>

              <h1 className="theme-heading max-w-3xl text-4xl font-bold sm:text-5xl lg:text-6xl">
                Start a kennel with dogs worth studying.
              </h1>

              <p className="theme-copy mt-5 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">
                ShowRing Game is a dog show and breeder simulation built around
                thoughtful pairings, directional visible categories, show
                strategy, and the slow satisfaction of improving a line.
              </p>

              <div className="mt-7 grid gap-3">
                {signupHighlights.map((item) => (
                  <div
                    key={item.title}
                    className="theme-card rounded-2xl p-4"
                  >
                    <h2 className="theme-heading text-sm font-semibold">
                      {item.title}
                    </h2>
                    <p className="theme-copy mt-2 text-sm leading-6">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="theme-card rounded-[24px] p-5 sm:p-6">
              <h2 className="theme-heading text-2xl font-semibold">
                Create Account
              </h2>
              <p className="theme-copy mt-2 text-sm leading-6">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="theme-accent-link font-semibold"
                >
                  Log in
                </Link>
                .
              </p>

              <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="theme-heading text-sm font-semibold">
                    Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="theme-control rounded-2xl px-4 py-3 outline-none"
                    autoComplete="email"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="theme-heading text-sm font-semibold">
                    Display Name
                  </span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="theme-control rounded-2xl px-4 py-3 outline-none"
                    placeholder="Optional"
                    autoComplete="nickname"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="theme-heading text-sm font-semibold">
                    Password
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="theme-control rounded-2xl px-4 py-3 outline-none"
                    autoComplete="new-password"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="theme-heading text-sm font-semibold">
                    Confirm Password
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="theme-control rounded-2xl px-4 py-3 outline-none"
                    autoComplete="new-password"
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
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </button>
              </form>

              <div className="theme-card theme-copy mt-5 rounded-2xl px-4 py-3 text-sm leading-6">
                After signup, you will create your kennel and choose where your
                first breeding program begins.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
