import Link from "next/link";
import { getSessionUserId } from "@/lib/session";

export default async function HomePage() {
  const userId = await getSessionUserId();

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <div className="mb-6 rounded-full border border-purple-700 bg-purple-950/40 px-4 py-1 text-sm font-medium text-purple-200">
          Alpha Development In Progress
        </div>

        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          ShowRing Game
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">
          Build your kennel, purchase dogs, breed future generations, and compete
          in a living online dog show simulation.
        </p>

        <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">
          The current alpha includes account creation, kennel setup, foundation
          dog purchasing, and kennel dog viewing. More systems are being added
          continuously.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          {!userId ? (
            <>
              <Link
                href="/signup"
                className="rounded-md bg-purple-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-600"
              >
                Create Account
              </Link>

              <Link
                href="/login"
                className="rounded-md border border-purple-500 px-6 py-3 text-sm font-semibold text-purple-200 transition hover:bg-purple-950/40"
              >
                Log In
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/kennel"
                className="rounded-md bg-purple-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-600"
              >
                Go to My Kennel
              </Link>

              <Link
                href="/market/foundation"
                className="rounded-md border border-purple-500 px-6 py-3 text-sm font-semibold text-purple-200 transition hover:bg-purple-950/40"
              >
                Browse Foundation Market
              </Link>
            </>
          )}
        </div>

        <div className="mt-16 grid w-full gap-4 text-left md:grid-cols-3">
          <div className="rounded-2xl border border-purple-900 bg-purple-950/30 p-5">
            <h2 className="text-lg font-semibold text-white">Create a Kennel</h2>
            <p className="mt-2 text-sm text-neutral-300">
              Start your account, establish your kennel, and receive your opening
              balance.
            </p>
          </div>

          <div className="rounded-2xl border border-purple-900 bg-purple-950/30 p-5">
            <h2 className="text-lg font-semibold text-white">Buy Dogs</h2>
            <p className="mt-2 text-sm text-neutral-300">
              Purchase foundation dogs from the market to begin building your
              breeding program.
            </p>
          </div>

          <div className="rounded-2xl border border-purple-900 bg-purple-950/30 p-5">
            <h2 className="text-lg font-semibold text-white">Grow Your Program</h2>
            <p className="mt-2 text-sm text-neutral-300">
              Future updates will expand showing, breeding, reputation, and long-term
              kennel strategy.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
