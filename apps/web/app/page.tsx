import Image from "next/image";
import Link from "next/link";

import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const primaryActions = [
  {
    title: "Show Calendar",
    body: "Open seeded shows, review judging blocks, and enter eligible kennel dogs.",
    href: "/shows",
    action: "Enter Shows",
    featured: true,
  },
  {
    title: "My Kennel",
    body: "Jump into your roster, kennel areas, health records, and daily operations.",
    href: "/kennel",
    action: "Open My Kennel",
  },
  {
    title: "Breeding and Litters",
    body: "Plan pairings, follow pregnancies, and review current and past litters.",
    href: "/litters",
    action: "View Litters",
  },
  {
    title: "Foundation and Player Market",
    body: "Browse released breeds, compare visible ring categories, and shop for dogs.",
    href: "/market",
    action: "Open Market",
  },
  {
    title: "Bulletin Board",
    body: "Talk with other kennels about shows, judges, wins, litters, and help.",
    href: "/bulletin",
    action: "Open Board",
  },
];

const communityLinks = [
  {
    title: "Dogs At Stud",
    body: "Browse public stud dogs and compare visible category strengths.",
    href: "/studs",
    action: "Browse Studs",
  },
  {
    title: "Kennel Prestige Top Ten",
    body: "See which kennels are climbing overall and breed-specific prestige rankings.",
    href: "/kennels/top-ten",
    action: "View Rankings",
  },
];

const placeholderCommunityCards = [
  {
    title: "Recent Champions",
    body: "Coming soon: a live community feed of newly finished champions.",
  },
  {
    title: "Recent Litters",
    body: "Coming soon: a running list of fresh litters born around ShowRing.",
  },
  {
    title: "Recent Bulletin Activity",
    body: "Coming soon: active discussion highlights from the bulletin board.",
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

function formatJoinedAt(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getNewKennelsCutoff(): Date {
  return new Date(Date.now() - 48 * 60 * 60 * 1000);
}

export default async function HomePage() {
  const userId = await getSessionUserId();
  const newKennels = await db.kennel.findMany({
    where: {
      createdAt: {
        gte: getNewKennelsCutoff(),
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 6,
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  });

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

        <section className="mb-8 grid gap-6 xl:grid-cols-[1.48fr_0.52fr] xl:items-stretch">
          <section className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(50,26,71,0.94),rgba(24,12,35,0.96))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.38)] sm:p-7">
            <div className="mb-3 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
              Community Landing Page
            </div>

            <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              The Show Ring Game: A Dog Show and Breeder Simulation.
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-purple-100/78">
              Follow what is happening around ShowRing, then jump back into
              your kennel, your dogs, and the next show weekend.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={userId ? "/shows" : "/login"}
                className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
              >
                {userId ? "Enter Shows" : "Log In to Show"}
              </Link>
              <Link
                href={userId ? "/kennel" : "/login"}
                className="rounded-xl border border-purple-300/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
              >
                {userId ? "Go to My Kennel" : "Open My Kennel"}
              </Link>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-black/20 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.26)]">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Welcome These New Kennels
              </h2>
              <p className="mt-1 text-sm text-purple-100/70">
                Joined in the last 48 hours
              </p>
            </div>

            {newKennels.length === 0 ? (
              <div className="mt-4 text-sm text-purple-100/72">
                No new kennels have joined recently.
              </div>
            ) : (
              <div className="mt-4 grid gap-2.5">
                {newKennels.map((kennel) => (
                  <div
                    key={kennel.id}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <Link
                      href={`/kennels/${kennel.slug}`}
                      className="truncate text-sm font-semibold text-white underline-offset-4 transition hover:text-fuchsia-100 hover:underline"
                    >
                      {kennel.name}
                    </Link>
                    <div className="mt-1 text-xs text-purple-100/65">
                      Joined {formatJoinedAt(kennel.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-white">
              Jump Back In
            </h2>
            <p className="mt-1 text-sm text-purple-100/72">
              Quick routes for getting back to the practical parts of the game.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {primaryActions.map((item) => (
              <article
                key={item.title}
                className={`rounded-[24px] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] ${
                  item.featured
                    ? "border border-sky-300/30 bg-sky-500/10 md:col-span-2 xl:col-span-2"
                    : "border border-purple-300/15 bg-white/5"
                }`}
              >
                <h3 className="text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 min-h-[5.25rem] text-sm leading-7 text-purple-100/72">
                  {item.body}
                </p>
                <Link
                  href={userId ? item.href : "/login"}
                  className={`mt-5 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                    item.featured
                      ? "bg-sky-600 hover:bg-sky-500"
                      : "bg-purple-600 hover:bg-purple-500"
                  }`}
                >
                  {userId ? item.action : "Log In"}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <div className="grid gap-4 md:grid-cols-2">
            {communityLinks.map((item) => (
              <article
                key={item.title}
                className="rounded-[22px] border border-purple-300/15 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
              >
                <h3 className="text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-purple-100/72">
                  {item.body}
                </p>
                <Link
                  href={userId ? item.href : "/login"}
                  className="mt-4 inline-flex rounded-xl border border-purple-300/25 bg-white/5 px-4 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                >
                  {userId ? item.action : "Log In"}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-white">
              Around ShowRing
            </h2>
            <p className="mt-1 text-sm text-purple-100/72">
              Community activity surfaces will live here as they come online.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {placeholderCommunityCards.map((card) => (
              <article
                key={card.title}
                className="rounded-[22px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
              >
                <div className="mb-3 inline-flex rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-amber-100">
                  Future Placeholder
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-purple-100/72">
                  {card.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-[24px] border border-white/10 bg-black/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Mini FAQ</h2>
            <Link
              href="/faq"
              className="rounded-xl border border-purple-300/25 bg-white/5 px-4 py-2 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
            >
              Full FAQ
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        </section>
      </div>
    </main>
  );
}
