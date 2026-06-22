import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
import { getCurrentEpoch } from "@/lib/gameClock";
import {
  getKennelGroomingSummary,
  listOpenGroomingJobs,
} from "@/server/services/grooming.service";
import {
  firstQueryValue,
  formatMoney,
  formatNumber,
  formatSignedNumber,
  getKennelServicesContext,
  ServiceMessages,
  ServicesHeader,
  type ServicesSearchParams,
} from "../shared";

type PageProps = {
  searchParams?: Promise<ServicesSearchParams>;
};

export default async function GroomingServicesPage({
  searchParams,
}: PageProps) {
  const { kennel } = await getKennelServicesContext();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const message = firstQueryValue(resolvedSearchParams.message);
  const error = firstQueryValue(resolvedSearchParams.error);
  const currentEpoch = getCurrentEpoch();
  const [groomingSummary, groomingJobs] = await Promise.all([
    getKennelGroomingSummary({
      kennelId: kennel.id,
      currentEpoch,
    }),
    listOpenGroomingJobs({
      kennelId: kennel.id,
      currentEpoch,
    }),
  ]);
  const noGroomingActionsRemaining =
    groomingSummary.groomingActionsRemainingThisWeek <= 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <ServicesHeader
        title="Grooming Assistance"
        description="Accept outside grooming jobs from other kennels, improve dogs' coat condition, earn income, and build grooming experience."
        balance={kennel.balance}
        showWorkBoardLink
      />

      <ServiceMessages message={message} error={error} />

      <section className="rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-5 shadow-[var(--dog-shadow)]">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/80">
            Grooming Assistance
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Outside Grooming Jobs
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--dog-copy)]">
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
          <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Used
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.groomingActionsUsedThisWeek} /{" "}
              {groomingSummary.totalGroomingActionLimit}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Own Dogs
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.selfGroomsCompletedThisWeek}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Outside Jobs
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.outsideGroomsCompletedThisWeek}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Remaining
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.groomingActionsRemainingThisWeek}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              Level
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.groomingLevel}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
            <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
              XP
            </div>
            <div className="mt-1 font-semibold text-white">
              {groomingSummary.groomingXp}
            </div>
          </div>
        </div>

        {groomingJobs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-6 text-sm text-[var(--dog-copy)]">
            No outside grooming jobs are available right now.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groomingJobs.map((job) => (
              <article
                key={job.listingId}
                className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {job.dogDisplayName}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--dog-copy)]">
                      {job.breedName} ({job.breedCode2}) - {job.regNumber}
                    </p>
                    <p className="mt-1 text-sm text-[var(--dog-copy)]">
                      Owner: {job.ownerKennelName}
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                    Pay: {formatMoney(job.price)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-[var(--dog-copy)] sm:grid-cols-4">
                  <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                      Coat
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {formatNumber(job.currentCoatCondition)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                      Grooming
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {job.groomingStatusLabel}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                      Net
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {formatSignedNumber(job.netGroomingImpact)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                      Listed
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      Epoch {job.listedAtEpoch}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3 sm:col-span-4">
                    <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
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
                    value="/kennel/services/grooming"
                  />
                  <ConfirmSubmitButton
                    message={`Accept grooming job for ${job.dogDisplayName}?`}
                    disabled={noGroomingActionsRemaining}
                    title={
                      noGroomingActionsRemaining
                        ? "No grooming actions remaining this week."
                        : undefined
                    }
                    className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {noGroomingActionsRemaining
                      ? "No Grooming Left"
                      : "Accept Grooming Job"}
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
