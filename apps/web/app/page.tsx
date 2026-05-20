import Image from "next/image";
import Link from "next/link";
import { getSessionUserId } from "@/lib/session";

const availableNow = [
  {
    title: "Foundation and Player Market",
    body: "Browse released breeds, compare visible ring categories, buy foundation dogs, and shop player-listed dogs.",
    href: "/market",
    action: "Open Market",
  },
  {
    title: "Kennel Dashboard",
    body: "Review your dogs, pregnancy status, breeding eligibility, market state, and current kennel balance.",
    href: "/kennel",
    action: "My Kennel",
  },
  {
    title: "Breeding and Litters",
    body: "Plan same-breed pairings, create breeding attempts, follow pregnancy timing, and review whelped litters.",
    href: "/litters",
    action: "View Litters",
  },
];

const quickStart = [
  "Create an account and establish your kennel.",
  "Choose a released breed and buy foundation stock.",
  "Open each dog page to review visible category summaries.",
  "Register permanent dog names when you are ready.",
  "Use Breed Dog from a dog page to plan eligible pairings.",
  "Watch Litters for pregnancy checks, due dates, and puppies.",
];

const betaNotes = [
  "Released breeds currently include levels 1 and 2.",
  "Hidden genotype is wider than visible phenotype, so litter outcomes carry risk.",
  "Player dog listings are live, with price editing and cancellation.",
  "Show entry and judging are planned as the next major gameplay side.",
];

export default async function HomePage() {
  const userId = await getSessionUserId();

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto flex max-w-7xl flex-col">
        <header className="mb-8 flex flex-col gap-6 rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="relative h-16 w-[250px] sm:h-20 sm:w-[320px]">
            <Image
              src="/logo.png"
              alt="ShowRing Game"
              fill
              className="object-contain object-left"
              priority
            />
          </div>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            {!userId ? (
              <>
                <Link
                  href="/signup"
                  className="rounded-full bg-purple-600 px-5 py-2.5 font-semibold text-white transition hover:bg-purple-500"
                >
                  Create Account
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-purple-300/30 bg-white/5 px-5 py-2.5 font-semibold text-purple-100 transition hover:bg-white/10"
                >
                  Log In
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/kennel"
                  className="rounded-full bg-purple-600 px-5 py-2.5 font-semibold text-white transition hover:bg-purple-500"
                >
                  Go to My Kennel
                </Link>
                <Link
                  href="/market"
                  className="rounded-full border border-purple-300/30 bg-white/5 px-5 py-2.5 font-semibold text-purple-100 transition hover:bg-white/10"
                >
                  Browse Market
                </Link>
              </>
            )}
          </nav>
        </header>

        <section className="mb-8 rounded-[32px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(50,26,71,0.94),rgba(24,12,35,0.96))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                Alpha build. Dogs may reset before beta.
              </div>

              <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Start a kennel, study the dogs, and build your first line.
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-purple-100/78 sm:text-lg sm:leading-8">
                ShowRing Game is currently strongest as a breeder and market
                simulation. Buy dogs, evaluate visible phenotype, breed litters,
                list dogs for sale, and watch hidden genotype show up in the
                next generation.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                {!userId ? (
                  <>
                    <Link
                      href="/signup"
                      className="rounded-2xl bg-purple-600 px-6 py-4 text-center text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition hover:bg-purple-500"
                    >
                      Create Your Kennel
                    </Link>
                    <Link
                      href="/login"
                      className="rounded-2xl border border-purple-300/25 bg-white/5 px-6 py-4 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                    >
                      Sign In
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/kennel"
                      className="rounded-2xl bg-purple-600 px-6 py-4 text-center text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition hover:bg-purple-500"
                    >
                      Enter My Kennel
                    </Link>
                    <Link
                      href="/market"
                      className="rounded-2xl border border-purple-300/25 bg-white/5 px-6 py-4 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                    >
                      Browse Dogs
                    </Link>
                    <Link
                      href="/litters"
                      className="rounded-2xl border border-purple-300/25 bg-white/5 px-6 py-4 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                    >
                      View Litters
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
              <h2 className="text-xl font-semibold text-white">
                Quick Start
              </h2>
              <ol className="mt-4 space-y-3">
                {quickStart.map((step, index) => (
                  <li
                    key={step}
                    className="grid grid-cols-[2.25rem_1fr] gap-3 text-sm leading-6 text-purple-100/75"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-purple-300/25 bg-purple-500/10 text-sm font-semibold text-purple-100">
                      {index + 1}
                    </span>
                    <span className="pt-1.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-purple-300/80">
                Available Now
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Current playable systems
              </h2>
            </div>
            {userId ? (
              <Link
                href="/breed"
                className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Plan a Breeding
              </Link>
            ) : null}
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {availableNow.map((item) => (
              <article
                key={item.title}
                className="rounded-[24px] border border-purple-300/15 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
              >
                <h3 className="text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 min-h-[5.25rem] text-sm leading-7 text-purple-100/72">
                  {item.body}
                </p>
                <Link
                  href={userId ? item.href : "/login"}
                  className="mt-5 inline-flex rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                  {userId ? item.action : "Log In"}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl font-semibold text-white">
              What to test first
            </h2>
            <div className="mt-4 space-y-3">
              {betaNotes.map((note) => (
                <div
                  key={note}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-purple-100/75"
                >
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(124,58,237,0.16),rgba(255,255,255,0.04))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl font-semibold text-white">
              Game Time
            </h2>
            <p className="mt-3 text-sm leading-7 text-purple-100/75">
              One real hour is one in-game day. Pregnancy checks, due dates,
              aging, market movement, and future show calendars all use that
              faster clock, so the kennel changes meaningfully across a normal
              play session.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-purple-200">
                  Breeding
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  Check, whelp, evaluate
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-purple-200">
                  Market
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  Buy, list, adjust
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-wide text-purple-200">
                  Shows
                </div>
                <div className="mt-2 text-sm font-medium text-white">
                  Coming next
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
