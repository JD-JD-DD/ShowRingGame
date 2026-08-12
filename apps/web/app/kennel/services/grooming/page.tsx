import GroomingJobAcceptanceForm from "@/components/kennel/GroomingJobAcceptanceForm";
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
    <main className="mx-auto max-w-7xl px-6 py-8">
      <ServicesHeader
        title="Grooming Assistance"
        description="Accept outside grooming jobs from other kennels, improve dogs' coat condition, earn income, and build grooming experience."
      />

      <ServiceMessages message={message} error={error} />

      <section className="theme-panel rounded-[28px] p-5">
        <div className="mb-5">
          <p className="theme-label text-xs font-semibold uppercase tracking-[0.2em]">
            Grooming Assistance
          </p>
          <h2 className="theme-heading mt-2 text-2xl font-semibold">
            Outside Grooming Jobs
          </h2>
          <p className="theme-copy mt-3 max-w-3xl text-sm leading-6">
            Help prep dogs for local exhibitors. Each kennel can perform 10
            grooming actions per game week. Use them on your own dogs, outside
            grooming jobs, or any combination of both.
          </p>
          <div className="theme-status-info mt-4 rounded-2xl px-4 py-3 text-sm leading-6">
            Outside grooming currently pays {formatMoney(500)} from the game.
            The listing owner is not charged during this stage of development.
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="theme-card rounded-xl p-3">
            <div className="theme-label text-xs uppercase tracking-wide">
              Used
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {groomingSummary.groomingActionsUsedThisWeek} /{" "}
              {groomingSummary.totalGroomingActionLimit}
            </div>
          </div>
          <div className="theme-card rounded-xl p-3">
            <div className="theme-label text-xs uppercase tracking-wide">
              Own Dogs
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {groomingSummary.selfGroomsCompletedThisWeek}
            </div>
          </div>
          <div className="theme-card rounded-xl p-3">
            <div className="theme-label text-xs uppercase tracking-wide">
              Outside Jobs
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {groomingSummary.outsideGroomsCompletedThisWeek}
            </div>
          </div>
          <div className="theme-card rounded-xl p-3">
            <div className="theme-label text-xs uppercase tracking-wide">
              Remaining
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {groomingSummary.groomingActionsRemainingThisWeek}
            </div>
          </div>
          <div className="theme-card rounded-xl p-3">
            <div className="theme-label text-xs uppercase tracking-wide">
              Level
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {groomingSummary.groomingLevel}
            </div>
          </div>
          <div className="theme-card rounded-xl p-3">
            <div className="theme-label text-xs uppercase tracking-wide">
              XP
            </div>
            <div className="theme-heading mt-1 font-semibold">
              {groomingSummary.groomingXp}
            </div>
          </div>
        </div>

        {groomingJobs.length === 0 ? (
          <div className="theme-card theme-copy rounded-2xl p-6 text-sm">
            No outside grooming jobs are available right now.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {groomingJobs.map((job) => (
              <article
                key={job.listingId}
                className="theme-card rounded-2xl p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="theme-heading text-lg font-semibold">
                      {job.dogDisplayName}
                    </h3>
                    <p className="theme-copy mt-1 text-sm">
                      {job.breedName} ({job.breedCode2}) - {job.regNumber}
                    </p>
                    <p className="theme-copy mt-1 text-sm">
                      Owner: {job.ownerKennelName}
                    </p>
                  </div>
                  <div className="theme-neutral-badge rounded-full px-3 py-1 text-sm font-semibold">
                    Pay: {formatMoney(job.price)}
                  </div>
                </div>

                <div className="theme-copy mt-4 grid gap-3 text-sm sm:grid-cols-4">
                  <div className="theme-card rounded-xl p-3">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Coat
                    </div>
                    <div className="theme-heading mt-1 font-semibold">
                      {formatNumber(job.currentCoatCondition)}
                    </div>
                  </div>
                  <div className="theme-card rounded-xl p-3">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Grooming
                    </div>
                    <div className="theme-heading mt-1 font-semibold">
                      {job.groomingStatusLabel}
                    </div>
                  </div>
                  <div className="theme-card rounded-xl p-3">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Net
                    </div>
                    <div className="theme-heading mt-1 font-semibold">
                      {formatSignedNumber(job.netGroomingImpact)}
                    </div>
                  </div>
                  <div className="theme-card rounded-xl p-3">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Listed
                    </div>
                    <div className="theme-heading mt-1 font-semibold">
                      Epoch {job.listedAtEpoch}
                    </div>
                  </div>
                  <div className="theme-card rounded-xl p-3 sm:col-span-4">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Paid By
                    </div>
                    <div className="theme-heading mt-1 font-semibold">Game</div>
                  </div>
                </div>

                <GroomingJobAcceptanceForm
                  action={`/api/services/grooming/listings/${job.listingId}/accept`}
                  dogDisplayName={job.dogDisplayName}
                  disabled={noGroomingActionsRemaining}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
