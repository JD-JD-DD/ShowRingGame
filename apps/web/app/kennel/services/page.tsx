import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { epochToDate, getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
import {
  getKennelGroomingSummary,
  listOpenGroomingJobs,
} from "@/server/services/grooming.service";
import { listStewardingOpportunities } from "@/server/services/kennelService.service";

type PageProps = {
  searchParams?: Promise<{
    message?: string | string[];
    error?: string | string[];
  }>;
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatDate(epoch: number): string {
  return epochToDate(epoch).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatNumber(value: number): string {
  return value.toFixed(2);
}

export default async function KennelServicesPage({ searchParams }: PageProps) {
  const userId = await getSessionUserId();

  if (!userId) {
    redirect("/login");
  }

  const kennel = await db.kennel.findUnique({
    where: { userId },
    select: {
      id: true,
      name: true,
      balance: true,
    },
  });

  if (!kennel) {
    redirect("/onboarding");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const message = firstQueryValue(resolvedSearchParams.message);
  const error = firstQueryValue(resolvedSearchParams.error);
  const currentEpoch = getCurrentEpoch();
  const [opportunities, groomingSummary, groomingJobs] = await Promise.all([
    listStewardingOpportunities({
      kennelId: kennel.id,
      currentEpoch,
    }),
    getKennelGroomingSummary({
      kennelId: kennel.id,
      currentEpoch,
    }),
    listOpenGroomingJobs({
      kennelId: kennel.id,
      currentEpoch,
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-200/80">
            Kennel Services
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Work Board</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-purple-100/75">
            Earn practical kennel income through dog-world service work. Club
            stewarding and grooming assistance are available now.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/kennel"
            className="rounded-2xl border border-purple-300/25 bg-white/5 px-5 py-3 text-sm font-semibold text-purple-100 transition hover:bg-white/10"
          >
            Back to My Kennel
          </Link>
          <div className="rounded-2xl border border-purple-300/15 bg-white/5 px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-purple-200">
              Balance
            </div>
            <div className="mt-1 text-xl font-semibold">
              {formatMoney(kennel.balance)}
            </div>
          </div>
        </div>
      </header>

      {message ? (
        <div className="mb-5 rounded-2xl border border-emerald-300/35 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-100">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 rounded-2xl border border-red-300/35 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/80">
              Club Stewarding
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Available Assignments
            </h2>
          </div>
          <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50">
            Taking a stewarding assignment makes that show/cluster your primary
            show commitment for the weekend. You cannot enter dogs in that show.
            Secondary shows in the same weekend may still be entered with
            traveling handlers where required.
          </div>
        </div>

        {opportunities.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-purple-100/70">
            No stewarding assignments are available right now.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {opportunities.map((opportunity) => (
              <article
                key={opportunity.showClusterId}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {opportunity.name}
                    </h3>
                    <p className="mt-1 text-sm text-purple-100/65">
                      {opportunity.districtName} District
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                    {formatMoney(opportunity.payoutAmount)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-purple-100/75 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200/70">
                      Dates
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {formatDate(opportunity.startEpoch)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200/70">
                      Days
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {opportunity.dayCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200/70">
                      Status
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {opportunity.alreadyStewarded
                        ? "Claimed"
                        : opportunity.availableSpaces > 0
                          ? "Open"
                          : "Full"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200/70">
                      Spaces
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {opportunity.availableSpaces} / {opportunity.totalSpaces}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-purple-100/65">
                  Stewarding pays {formatMoney(opportunity.payoutAmount)}, but
                  you cannot owner-handle dogs in this exact show/cluster. Each
                  kennel may hold one stewarding assignment per show weekend.
                </p>

                {opportunity.blockedReason ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-purple-100/70">
                    {opportunity.blockedReason}
                  </div>
                ) : null}

                <form
                  action="/api/kennel/services/stewarding/claim"
                  method="post"
                  className="mt-4"
                >
                  <input
                    type="hidden"
                    name="showClusterId"
                    value={opportunity.showClusterId}
                  />
                  <button
                    type="submit"
                    disabled={!opportunity.canClaim}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Steward this show
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
            Grooming Assistance
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Outside Grooming Jobs
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-purple-100/75">
            Help prep dogs for local exhibitors. Each kennel can perform 10
            grooming actions per game week. Use them on your own dogs, outside
            grooming jobs, or any combination of both.
          </p>
          <div className="mt-4 rounded-2xl border border-sky-300/25 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-sky-50">
            Outside grooming currently pays {formatMoney(500)} from the game.
            The listing owner is not charged during this stage of development.
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-wide text-purple-200/70">
              Used
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.groomingActionsUsedThisWeek} /{" "}
              {groomingSummary.totalGroomingActionLimit}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-wide text-purple-200/70">
              Own Dogs
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.selfGroomsCompletedThisWeek}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-wide text-purple-200/70">
              Outside Jobs
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.outsideGroomsCompletedThisWeek}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-wide text-purple-200/70">
              Remaining
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.groomingActionsRemainingThisWeek}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-wide text-purple-200/70">
              Level
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.groomingLevel}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-wide text-purple-200/70">
              XP
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.groomingXp}
            </div>
          </div>
        </div>

        {groomingJobs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-purple-100/70">
            No outside grooming jobs are available right now.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groomingJobs.map((job) => (
              <article
                key={job.listingId}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {job.dogDisplayName}
                    </h3>
                    <p className="mt-1 text-sm text-purple-100/65">
                      {job.breedName} ({job.breedCode2}) - {job.regNumber}
                    </p>
                    <p className="mt-1 text-sm text-purple-100/65">
                      Owner: {job.ownerKennelName}
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                    Pay: {formatMoney(job.price)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-purple-100/75 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200/70">
                      Coat
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {formatNumber(job.currentCoatCondition)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200/70">
                      Listed
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      Epoch {job.listedAtEpoch}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-wide text-purple-200/70">
                      Paid By
                    </div>
                    <div className="mt-1 font-semibold text-white">Game</div>
                  </div>
                </div>

                <form
                  action={`/api/services/grooming/listings/${job.listingId}/accept`}
                  method="post"
                  className="mt-4"
                >
                  <input
                    type="hidden"
                    name="returnTo"
                    value="/kennel/services"
                  />
                  <ConfirmSubmitButton
                    message={`Accept grooming job for ${job.dogDisplayName}?`}
                    disabled={
                      groomingSummary.groomingActionsRemainingThisWeek <= 0
                    }
                    className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Accept Grooming Job
                  </ConfirmSubmitButton>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
