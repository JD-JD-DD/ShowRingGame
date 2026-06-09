import Image from "next/image";
import Link from "next/link";

import { db } from "@/lib/db";
import { formatDogDisplayName } from "@/lib/dogNames";
import { getSessionUserId } from "@/lib/session";
import { SHOW_WEEK_HOURS, SHOW_YEAR_HOURS } from "@showring/rules";


const primaryActions = [
  {
    title: "Shows",
    body: "Open the show calendar to browse clusters, entries, results, and planning details.",
    href: "/shows",
    action: "Open Show Calendar",
    featured: true,
  },
  {
    title: "New Users Start Here",
    body: "Browse released breeds, compare visible ring categories, and shop for dogs.",
    href: "/market",
    action: "Open Market",
  },
  {
    title: "Kennel Prestige Top Ten",
    body: "See which kennels are climbing overall and breed-specific prestige rankings.",
    href: "/kennels/top-ten",
    action: "View Rankings",
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

function formatGameTimeLabel(epoch: number): string {
  const year = Math.floor(epoch / SHOW_YEAR_HOURS) + 1;
  const hourInYear = epoch % SHOW_YEAR_HOURS;
  const week = Math.floor(hourInYear / SHOW_WEEK_HOURS) + 1;
  const day = hourInYear % SHOW_WEEK_HOURS;

  return `Y${year} W${week} D${day + 1}`;
}

export default async function HomePage() {
  const userId = await getSessionUserId();
  const [newKennels, championNotices, recentLitters] = await Promise.all([
    db.kennel.findMany({
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
    }),
    db.kennelNotice.findMany({
      where: {
        type: "NEW_CHAMPION",
        linkedDogId: {
          not: null,
        },
      },
      orderBy: [{ createdAtEpoch: "desc" }],
      take: 10,
      select: {
        id: true,
        createdAtEpoch: true,
        kennel: {
          select: {
            name: true,
            slug: true,
          },
        },
        linkedDogId: true,
      },
    }),
    db.litter.findMany({
      orderBy: [{ bornEpoch: "desc" }],
      take: 5,
      select: {
        id: true,
        bornEpoch: true,
        pupCount: true,
        breed: {
          select: {
            name: true,
          },
        },
        sire: {
          select: {
            regNumber: true,
            callName: true,
            registeredName: true,
            visibleTitlePrefix: true,
            visibleTitleSuffix: true,
          },
        },
        dam: {
          select: {
            regNumber: true,
            callName: true,
            registeredName: true,
            visibleTitlePrefix: true,
            visibleTitleSuffix: true,
          },
        },
        bredByKennel: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  const championDogIds = championNotices
    .map((notice) => notice.linkedDogId)
    .filter((dogId): dogId is string => Boolean(dogId));
  const championDogs =
    championDogIds.length > 0
      ? await db.dog.findMany({
          where: {
            id: {
              in: championDogIds,
            },
            isPlayerVisible: true,
          },
          select: {
            id: true,
            regNumber: true,
            callName: true,
            registeredName: true,
            visibleTitlePrefix: true,
            visibleTitleSuffix: true,
            breed: {
              select: {
                name: true,
              },
            },
            ownerKennel: {
              select: {
                name: true,
                slug: true,
              },
            },
            showAwards: {
              where: {
                pointsAwarded: {
                  gt: 0,
                },
              },
              orderBy: [{ publishedAtEpoch: "desc" }],
              take: 8,
              select: {
                publishedAtEpoch: true,
                showDay: {
                  select: {
                    scheduledEpoch: true,
                    cluster: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })
      : [];
  const championDogById = new Map(
    championDogs.map((dog) => [dog.id, dog] as const)
  );
  const recentChampions = championNotices
    .map((notice) => {
      const dog = notice.linkedDogId
        ? championDogById.get(notice.linkedDogId)
        : null;

      if (!dog) {
        return null;
      }

      const finishingAward =
        dog.showAwards.find(
          (award) => award.publishedAtEpoch <= notice.createdAtEpoch
        ) ?? dog.showAwards[0] ?? null;

      return {
        id: notice.id,
        createdAtEpoch: notice.createdAtEpoch,
        dog,
        ownerKennel: dog.ownerKennel ?? notice.kennel,
        finishingCluster: finishingAward?.showDay.cluster ?? null,
      };
    })
    .filter((item) => item !== null);

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto flex max-w-7xl flex-col">
        <header className="mb-8 flex flex-col gap-6 rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-[250px] sm:h-20 sm:w-[320px]">
              <Image
                src="/logo.png"
                alt="ShowRing Game"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
            <div className="hidden flex-1 items-center justify-center md:flex">
              <h1
                className="showring-title-sweep text-4xl font-black tracking-wide lg:text-5xl"
                data-text="The Show Ring Game"
              >
                The Show Ring Game
              </h1>
            </div>
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

        <section className="mb-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr] xl:items-stretch">
          <section className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-white">
                Around ShowRing
              </h2>
              <p className="mt-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                <span className="font-bold">IMPORTANT:</span> Alpha testing has unlimited funds to encourage large kennels and lots of game play. Go Wild!
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <article className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                <h3 className="text-lg font-semibold text-white">
                  Recent Champions
                </h3>
                <p className="mt-1 text-sm text-purple-100/65">
                  Newly finished champions across the game.
                </p>

                {recentChampions.length === 0 ? (
                  <p className="mt-4 text-sm text-purple-100/72">
                    No new champions have finished recently.
                  </p>
                ) : (
                  <div className="mt-4 grid max-h-[24rem] gap-2.5 overflow-y-auto pr-1">
                    {recentChampions.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <Link
                          href={`/dogs/${item.dog.id}`}
                          className="text-sm font-semibold text-white underline-offset-4 transition hover:text-fuchsia-100 hover:underline"
                        >
                          {formatDogDisplayName(item.dog)}
                        </Link>
                        <div className="mt-1 text-xs text-purple-100/65">
                          {item.dog.breed.name}
                          {item.ownerKennel ? (
                            <>
                              {" "}
                              ·{" "}
                              <Link
                                href={`/kennels/${item.ownerKennel.slug}`}
                                className="underline-offset-4 transition hover:text-fuchsia-100 hover:underline"
                              >
                                {item.ownerKennel.name}
                              </Link>
                            </>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-purple-100/55">
                          {item.finishingCluster ? (
                            <>
                              Finished at{" "}
                              <Link
                                href={`/shows/${item.finishingCluster.id}/results`}
                                className="underline-offset-4 transition hover:text-sky-100 hover:underline"
                              >
                                {item.finishingCluster.name}
                              </Link>
                            </>
                          ) : (
                            "Finished show details coming soon."
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="rounded-[22px] border border-white/10 bg-black/20 p-5">
                <h3 className="text-lg font-semibold text-white">
                  Recent Litters
                </h3>
                <p className="mt-1 text-sm text-purple-100/65">
                  The latest litters born around ShowRing.
                </p>

                {recentLitters.length === 0 ? (
                  <p className="mt-4 text-sm text-purple-100/72">
                    No litters have been born recently.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-2.5">
                    {recentLitters.map((litter) => (
                      <div
                        key={litter.id}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div className="text-sm font-semibold text-white">
                          {litter.breed.name} litter
                        </div>
                        <div className="mt-1 text-xs text-purple-100/65">
                          {formatDogDisplayName(litter.sire)} x{" "}
                          {formatDogDisplayName(litter.dam)}
                        </div>
                        <div className="mt-1 text-xs text-purple-100/55">
                          {litter.pupCount} puppies · {formatGameTimeLabel(litter.bornEpoch)}
                          {litter.bredByKennel ? (
                            <>
                              {" "}
                              ·{" "}
                              <Link
                                href={`/kennels/${litter.bredByKennel.slug}`}
                                className="underline-offset-4 transition hover:text-fuchsia-100 hover:underline"
                              >
                                {litter.bredByKennel.name}
                              </Link>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
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

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
            {primaryActions.map((item) => (
              <article
                key={item.title}
                className={`rounded-[24px] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] ${
                  item.featured
                    ? "border border-sky-300/30 bg-sky-500/10"
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
