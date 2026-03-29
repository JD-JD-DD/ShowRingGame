import Image from "next/image";
import Link from "next/link";
import { getSessionUserId } from "@/lib/session";

export default async function HomePage() {
  const userId = await getSessionUserId();

  return (
    <main className="min-h-screen px-6 py-8 text-white">
      <div className="mx-auto flex max-w-7xl flex-col">
        <header className="mb-10 flex flex-col gap-6 rounded-[28px] border border-white/10 bg-white/5 px-6 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur md:flex-row md:items-center md:justify-between">
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
                  href="/market/foundation"
                  className="rounded-full border border-purple-300/30 bg-white/5 px-5 py-2.5 font-semibold text-purple-100 transition hover:bg-white/10"
                >
                  Browse Market
                </Link>
              </>
            )}
          </nav>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[32px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(50,26,71,0.9),rgba(24,12,35,0.92))] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.38)]">
            <div className="mb-4 inline-flex rounded-full border border-purple-300/20 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
              Early Beta
            </div>

            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Build a kennel. Buy dogs. Breed the next great winner.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-purple-100/85">
              ShowRing Game is a browser-based dog show simulation built around
              kennel strategy, breeding programs, market decisions, and long-term
              competition.
            </p>

            <p className="mt-4 max-w-2xl text-base leading-7 text-purple-100/70">
              Start your account, establish your kennel, buy foundation dogs,
              and begin building a line that can compete, reproduce, and shape
              the future of your program.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
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
                    href="/market/foundation"
                    className="rounded-2xl border border-purple-300/25 bg-white/5 px-6 py-4 text-center text-sm font-semibold text-purple-100 transition hover:bg-white/10"
                  >
                    View Foundation Dogs
                  </Link>
                </>
              )}
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-purple-200">
                  01
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">
                  Create a Kennel
                </h2>
                <p className="mt-2 text-sm leading-6 text-purple-100/70">
                  Set up your account, receive starter funds, and establish your
                  place in the game world.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-purple-200">
                  02
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">
                  Buy Foundation Dogs
                </h2>
                <p className="mt-2 text-sm leading-6 text-purple-100/70">
                  Browse available dogs, compare visible ring categories, and
                  choose the stock that will anchor your program.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-purple-200">
                  03
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">
                  Grow Your Program
                </h2>
                <p className="mt-2 text-sm leading-6 text-purple-100/70">
                  Breed future generations, enter shows, and develop a kennel
                  with identity, depth, and long-term goals.
                </p>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-purple-300/15 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <h2 className="text-xl font-semibold text-white">Current Beta Focus</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-sm font-medium text-purple-100">Accounts and kennel setup</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-sm font-medium text-purple-100">Foundation dog purchasing</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-sm font-medium text-purple-100">Kennel roster viewing</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-sm font-medium text-purple-100">Dog pages, breeding, and show flow next</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-purple-300/15 bg-[linear-gradient(180deg,rgba(124,58,237,0.18),rgba(255,255,255,0.04))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <h2 className="text-xl font-semibold text-white">Design Direction</h2>
              <p className="mt-3 text-sm leading-7 text-purple-100/75">
                This version keeps the purple identity, gives the site more
                presence, and sets up a stronger visual shell for kennel,
                market, and dog-detail pages.
              </p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
                  Next step after home
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  My Kennel dashboard
                </div>
                <p className="mt-2 text-sm leading-6 text-purple-100/70">
                  We’ll turn it into the command center: kennel summary, quick
                  actions, recent dogs, and direct path into market and dog pages.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
