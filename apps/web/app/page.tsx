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
  {
    title: "Show Calendar",
    body: "Open seeded shows, review judging blocks, enter eligible kennel dogs, and run test judging.",
    href: "/shows",
    action: "Enter Shows",
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

const beginnerTips = [
  "Start with a small number of dogs.",
  "Pay attention to visible category strengths.",
  "Breed for balance, not perfection.",
  "Plan for future generations.",
];

const miniFaq = [
  {
    question: "How does breeding work?",
    answer:
      "Select an eligible sire and dam, submit the breeding, wait for the pregnancy check, then follow the litter through whelping.",
  },
  {
    question: "Are foundation dogs all the same quality?",
    answer:
      "No. Some have standout strengths, others have faults to breed around. Finding useful starting dogs is part of the game.",
  },
  {
    question: "Are dog stats random?",
    answer:
      "Each dog has hidden inherited traits. You see visible show categories, but the exact genetic values stay private.",
  },
  {
    question: "How does time work?",
    answer:
      "One real-life hour is one in-game day, so aging, pregnancy checks, gestation, and future show schedules move quickly.",
  },
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
                Dog show and breeder simulation
              </div>

              <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Start a kennel, study the dogs, and build your first line.
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-purple-100/78 sm:text-lg sm:leading-8">
                The Show Ring Game: A Dog Show and Breeder Simulation
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
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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

        <section>
          <div className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">
                Mini FAQ
              </h2>
              <Link
                href="/faq"
                className="rounded-xl border border-purple-300/25 bg-white/5 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                Full FAQ
              </Link>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
              <div className="rounded-2xl border border-purple-300/20 bg-purple-500/10 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-purple-100">
                  Quick Beginner Tips
                </h3>
                <ul className="mt-3 space-y-2">
                  {beginnerTips.map((tip) => (
                    <li
                      key={tip}
                      className="text-sm leading-6 text-purple-100/78"
                    >
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {miniFaq.map((item) => (
                  <div
                    key={item.question}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <h3 className="text-sm font-semibold text-white">
                      {item.question}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-purple-100/72">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
