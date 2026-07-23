import Image from "next/image";
import Link from "next/link";

import { HomePayPalButton } from "@/components/payments/HomePayPalButton";
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
    title: "New? Start Here",
    body: "Follow the beginner guide through buying foundation dogs, opening dog pages, shows, breeding, and results.",
    href: "/start-up-guide",
    action: "Open Guide",
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
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-7xl flex-col">
        <header className="theme-panel mb-8 grid gap-6 rounded-[28px] px-6 py-5 backdrop-blur lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
          <div className="flex justify-center lg:justify-start">
            <div className="relative h-16 w-[250px] sm:h-20 sm:w-[320px]">
              <Image
                src="/logo.png"
                alt="ShowRing Game"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </div>

          <div className="text-center">
            <h1
              className="showring-title-sweep text-3xl font-black tracking-wide sm:text-4xl xl:text-5xl"
              data-text="The Show Ring Game"
            >
              The Show Ring Game
            </h1>
          </div>

          <nav className="grid justify-center gap-x-3 gap-y-3 text-sm sm:grid-cols-[auto_auto] sm:items-center lg:justify-end">
            <div className="order-2 flex flex-col gap-3">
              <Link
                href="/start-up-guide"
                className="theme-secondary-button rounded-full px-5 py-2.5 font-semibold"
              >
                New? Start Here
              </Link>
              <Link
                href="/kennel"
                className="theme-primary-button rounded-full px-5 py-2.5 font-semibold"
              >
                Go to My Kennel
              </Link>
            </div>

            <div className="order-1 flex flex-col items-center gap-1.5 sm:items-start">
              <span className="text-xs font-semibold text-[var(--dog-copy)]">
                Join the community
              </span>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://www.facebook.com/groups/1804836923805526"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join the ShowRing Game Facebook group"
                  title="Join the ShowRing Game Facebook group"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-1.5 text-xs font-semibold text-[var(--dog-heading)] transition hover:border-[var(--dog-border-strong)] hover:bg-purple-500/10"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-current"
                  >
                    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.099 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.235 2.686.235v2.97h-1.513c-1.49 0-1.956.931-1.956 1.886v2.266h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.099 24 12.073Z" />
                  </svg>
                </a>
                <a
                  href="https://discord.gg/qFFDmWY6WN"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Join the ShowRing Game Discord server"
                  title="Join the ShowRing Game Discord server"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-1.5 text-xs font-semibold text-[var(--dog-heading)] transition hover:border-[var(--dog-border-strong)] hover:bg-purple-500/10"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-current"
                  >
                    <path d="M20.32 4.37A19.79 19.79 0 0 0 15.4 2.84a.07.07 0 0 0-.08.03c-.21.38-.44.87-.6 1.25a18.27 18.27 0 0 0-5.44 0c-.16-.39-.4-.87-.61-1.25a.08.08 0 0 0-.08-.03 19.74 19.74 0 0 0-4.92 1.53.07.07 0 0 0-.03.03C.53 9.07-.29 13.63.11 18.13c0 .02.01.04.03.05a19.9 19.9 0 0 0 6.03 3.03.08.08 0 0 0 .08-.03c.47-.64.88-1.32 1.23-2.03a.08.08 0 0 0-.04-.11 12.96 12.96 0 0 1-1.85-.88.08.08 0 0 1-.01-.13l.39-.3a.07.07 0 0 1 .08-.01c3.89 1.78 8.1 1.78 11.94 0a.07.07 0 0 1 .08.01l.4.3c.04.03.04.1-.01.13-.59.35-1.2.64-1.85.88a.08.08 0 0 0-.04.11c.36.7.77 1.39 1.23 2.03a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.04-3.03.08.08 0 0 0 .03-.05c.48-5.2-.81-9.72-3.41-13.73a.06.06 0 0 0-.03-.03ZM8.02 15.4c-1.18 0-2.15-1.08-2.15-2.4 0-1.32.95-2.4 2.15-2.4 1.21 0 2.17 1.09 2.15 2.4 0 1.32-.95 2.4-2.15 2.4Zm7.95 0c-1.18 0-2.15-1.08-2.15-2.4 0-1.32.95-2.4 2.15-2.4 1.21 0 2.17 1.09 2.15 2.4 0 1.32-.94 2.4-2.15 2.4Z" />
                  </svg>
                </a>
              </div>
            </div>
          </nav>
        </header>

        <section className="mb-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr] xl:items-stretch">
          <section className="theme-panel rounded-[24px] p-5">
            <div className="mb-4">
              <h2 className="theme-heading text-2xl font-semibold">
                Around ShowRing
              </h2>
              <p className="theme-notice theme-notice--danger mt-1 px-3 py-2 text-sm">
                <span className="font-bold">IMPORTANT:</span> Alpha testing has unlimited funds to encourage large kennels and lots of game play. Go Wild!
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <article className="theme-card rounded-[22px] p-5">
                <h3 className="theme-heading text-lg font-semibold">
                  Recent Champions
                </h3>
                <p className="mt-1 text-sm text-[var(--dog-copy)]">
                  Newly finished champions across the game.
                </p>

                {recentChampions.length === 0 ? (
                  <p className="mt-4 text-sm text-[var(--dog-copy)]">
                    No new champions have finished recently.
                  </p>
                ) : (
                  <div className="mt-4 grid max-h-[24rem] gap-2.5 overflow-y-auto pr-1">
                    {recentChampions.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3"
                      >
                        <Link
                          href={`/dogs/${item.dog.id}`}
                          className="theme-heading text-sm font-semibold underline-offset-4 transition hover:text-fuchsia-100 hover:underline"
                        >
                          {formatDogDisplayName(item.dog)}
                        </Link>
                        <div className="mt-1 text-xs text-[var(--dog-copy)]">
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
                        <div className="mt-1 text-xs text-[var(--dog-copy)]">
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

              <article className="theme-card rounded-[22px] p-5">
                <h3 className="theme-heading text-lg font-semibold">
                  Recent Litters
                </h3>
                <p className="mt-1 text-sm text-[var(--dog-copy)]">
                  The latest litters born around ShowRing.
                </p>

                {recentLitters.length === 0 ? (
                  <p className="mt-4 text-sm text-[var(--dog-copy)]">
                    No litters have been born recently.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-2.5">
                    {recentLitters.map((litter) => (
                      <div
                        key={litter.id}
                        className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3"
                      >
                        <div className="theme-heading text-sm font-semibold">
                          {litter.breed.name} litter
                        </div>
                        <div className="mt-1 text-xs text-[var(--dog-copy)]">
                          {formatDogDisplayName(litter.sire)} x{" "}
                          {formatDogDisplayName(litter.dam)}
                        </div>
                        <div className="mt-1 text-xs text-[var(--dog-copy)]">
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

          <div className="flex flex-col gap-6">
            <section className="theme-panel rounded-[24px] p-5">
              <div>
                <h2 className="theme-heading text-xl font-semibold">
                  Welcome These New Kennels
                </h2>
                <p className="mt-1 text-sm text-[var(--dog-copy)]">
                  Joined in the last 48 hours
                </p>
              </div>

              {newKennels.length === 0 ? (
                <div className="mt-4 text-sm text-[var(--dog-copy)]">
                  No new kennels have joined recently.
                </div>
              ) : (
                <div className="mt-4 grid gap-2.5">
                  {newKennels.map((kennel) => (
                    <div
                      key={kennel.id}
                      className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3"
                    >
                      <Link
                        href={`/kennels/${kennel.slug}`}
                        className="theme-heading truncate text-sm font-semibold underline-offset-4 transition hover:text-fuchsia-100 hover:underline"
                      >
                        {kennel.name}
                      </Link>
                      <div className="mt-1 text-xs text-[var(--dog-copy)]">
                        Joined {formatJoinedAt(kennel.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section
              className="theme-panel rounded-[24px] p-5"
              aria-label="PayPal button"
            >
              <HomePayPalButton />
            </section>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="theme-heading text-2xl font-semibold">
              Jump Back In
            </h2>
            <p className="mt-1 text-sm text-[var(--dog-copy)]">
              Quick routes for getting back to the practical parts of the game.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
            {primaryActions.map((item) => (
              <article
                key={item.title}
                className={`rounded-[24px] p-5 shadow-[var(--dog-shadow)] ${
                  item.featured
                    ? "theme-status-info border"
                    : "theme-card border"
                }`}
              >
                <h3 className="theme-heading text-lg font-semibold">
                  {item.title}
                </h3>
                <p className="mt-3 min-h-[5.25rem] text-sm leading-7 text-[var(--dog-copy)]">
                  {item.body}
                </p>
                <Link
                  href={userId ? item.href : "/login"}
                  className={`mt-5 inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                    item.featured
                      ? "rounded-xl border border-sky-700 bg-sky-700 hover:bg-sky-800"
                      : "theme-primary-button"
                  }`}
                >
                  {userId ? item.action : "Log In"}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="theme-panel mb-8 rounded-[24px] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="theme-heading text-xl font-semibold">Mini FAQ</h2>
            <Link
              href="/faq"
              className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Full FAQ
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {miniFaq.map((item) => (
              <div
                key={item.question}
                className="theme-card rounded-2xl p-4"
              >
                <h3 className="theme-heading text-sm font-semibold">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--dog-copy)]">
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
