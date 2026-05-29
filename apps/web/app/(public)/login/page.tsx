"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const loginHighlights = [
  "Check your kennel, litters, show entries, and notices.",
  "Follow results, title progress, and dogs at stud.",
  "Keep building your line one careful choice at a time.",
];

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
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto flex max-w-7xl flex-col">
        <header className="mb-8 flex flex-col gap-6 rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur md:flex-row md:items-center md:justify-between">
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
              className="rounded-full border border-purple-300/25 bg-white/5 px-5 py-2.5 font-semibold text-purple-100 transition hover:bg-white/10"
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

        <section className="rounded-[32px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(50,26,71,0.94),rgba(24,12,35,0.96))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                Player Login
              </div>

              <h1 className="max-w-3xl text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
                Welcome back to the ring.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-purple-100/78 sm:text-lg sm:leading-8">
                Sign in to manage your kennel, plan breedings, enter shows, and
                keep an eye on the dogs carrying your name forward.
              </p>

              <div className="mt-7 grid gap-3">
                {loginHighlights.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-purple-100/78"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-5 sm:p-6">
              <h2 className="text-2xl font-semibold text-white">Log in</h2>
              <div className="mt-4 rounded-2xl border border-purple-300/30 bg-purple-500/12 px-4 py-4 shadow-[0_12px_28px_rgba(126,34,206,0.18)]">
                <p className="text-sm font-semibold text-white">
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
                  <span className="text-sm font-semibold text-purple-100">
                    Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="rounded-2xl border border-purple-300/20 bg-[#15091f] px-4 py-3 text-white outline-none transition placeholder:text-purple-100/35 focus:border-purple-300/55 focus:bg-[#1b0d27]"
                    autoComplete="email"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-purple-100">
                    Password
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="rounded-2xl border border-purple-300/20 bg-[#15091f] px-4 py-3 text-white outline-none transition placeholder:text-purple-100/35 focus:border-purple-300/55 focus:bg-[#1b0d27]"
                    autoComplete="current-password"
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
                  {isSubmitting ? "Signing In..." : "Login"}
                </button>
              </form>

              <div className="mt-5 rounded-2xl border border-purple-300/15 bg-white/5 px-4 py-3 text-sm leading-6 text-purple-100/72">
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
