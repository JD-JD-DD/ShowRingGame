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
    title: "Dogs At Stud",
    body: "Browse public stud dogs, compare visible category strengths, and plan outside breedings for your bitches.",
    href: "/studs",
    action: "Browse Studs",
  },
  {
    title: "Breeding and Litters",
    body: "Plan same-breed pairings, create breeding attempts, follow pregnancy timing, and review whelped litters.",
    href: "/litters",
    action: "View Litters",
  },
  {
    title: "Show Calendar",
    body: "Open seeded shows, review judging blocks, and enter eligible kennel dogs.",
    href: "/shows",
    action: "Enter Shows",
  },
  {
    title: "Bulletin Board",
    body: "Talk with active kennels about shows, judges, wins, litters, stud ads, and help.",
    href: "/bulletin",
    action: "Open Board",
  },
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
            <Link
              href="/kennel"
              className="rounded-full bg-purple-600 px-5 py-2.5 font-semibold text-white transition hover:bg-purple-500"
            >
              Go to My Kennel
            </Link>
          </nav>
        </header>

        <section className="mb-8 rounded-[32px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(50,26,71,0.94),rgba(24,12,35,0.96))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                The Show Ring Game
              </div>

              <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                The Show Ring Game: A Dog Show and Breeder Simulation.
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-purple-100/78 sm:text-lg sm:leading-8">
                Start a kennel, breed litters, and show your dogs.
              </p>

            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">Mini FAQ</h2>
                <Link
                  href="/faq"
                  className="rounded-xl border border-purple-300/25 bg-white/5 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                >
                  Full FAQ
                </Link>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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

        <section className="mb-8">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
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

      </div>
    </main>
  );
}
