import Link from "next/link";

import { getCurrentEpoch } from "@/lib/gameClock";
import {
  getKennelGroomingSummary,
  listOpenGroomingJobs,
} from "@/server/services/grooming.service";
import { listStewardingOpportunities } from "@/server/services/kennelService.service";
import {
  firstQueryValue,
  formatMoney,
  getKennelServicesContext,
  ServiceMessages,
  ServicesHeader,
  type ServicesSearchParams,
} from "./shared";

type PageProps = {
  searchParams?: Promise<ServicesSearchParams>;
};

function ServiceCard({
  title,
  description,
  metadata,
  href,
  action,
}: {
  title: string;
  description: string;
  metadata: string[];
  href: string;
  action: string;
}) {
  return (
    <article className="theme-panel rounded-[28px] p-5">
      <div>
        <h2 className="theme-heading text-2xl font-semibold">{title}</h2>
        <p className="theme-copy mt-3 min-h-[4.5rem] text-sm leading-7">
          {description}
        </p>
      </div>

      <div className="mt-5 grid gap-2">
        {metadata.map((item) => (
          <div
            key={item}
            className="theme-card rounded-xl px-3 py-2 text-sm font-semibold"
          >
            {item}
          </div>
        ))}
      </div>

      <Link
        href={href}
        className="theme-primary-button mt-5 inline-flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold"
      >
        {action}
      </Link>
    </article>
  );
}

function ComingSoonCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="theme-card rounded-[28px] p-5 opacity-75">
      <div className="flex items-start justify-between gap-3">
        <h2 className="theme-heading text-xl font-semibold">{title}</h2>
        <span className="theme-neutral-badge rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
          Coming later
        </span>
      </div>
      <p className="theme-copy mt-3 text-sm leading-7">
        {description}
      </p>
    </article>
  );
}

function GroomingAssistancePanel({
  openJobs,
  actionsUsed,
  actionLimit,
}: {
  openJobs: number;
  actionsUsed: number;
  actionLimit: number;
}) {
  return (
    <article className="theme-panel rounded-2xl px-4 py-3 lg:col-span-2">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(8rem,0.75fr)_minmax(11rem,0.9fr)_minmax(10rem,0.85fr)] lg:items-center">
        <div className="min-w-0">
          <h2 className="theme-heading text-lg font-semibold">
            Grooming Assistance
          </h2>
          <p className="theme-copy mt-1 text-xs leading-5">
            Accept outside grooming jobs from other kennels, improve dogs' coat
            condition, earn income, and build grooming experience.
          </p>
        </div>

        <div className="theme-card rounded-xl px-3 py-2">
          <div className="theme-label text-[0.68rem] font-semibold uppercase tracking-wide">
            Open Jobs
          </div>
          <div className="theme-heading mt-1 text-sm font-semibold">
            {openJobs} job{openJobs === 1 ? "" : "s"}
          </div>
        </div>

        <div className="theme-card rounded-xl px-3 py-2">
          <div className="theme-label text-[0.68rem] font-semibold uppercase tracking-wide">
            Weekly Actions
          </div>
          <div className="theme-heading mt-1 text-sm font-semibold">
            {actionsUsed} / {actionLimit} used
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
          <div className="theme-card rounded-xl px-3 py-2 text-sm font-semibold">
            {formatMoney(500)} per job
          </div>
          <Link
            href="/kennel/services/grooming"
            className="theme-primary-button inline-flex justify-center rounded-xl px-3 py-2 text-xs font-semibold"
          >
            View Grooming Jobs
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function KennelServicesPage({ searchParams }: PageProps) {
  const { kennel } = await getKennelServicesContext();
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
  const openStewardingAssignments = opportunities.filter(
    (opportunity) => opportunity.availableSpaces > 0
  ).length;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <ServicesHeader
        title="Work Board"
        description="Earn practical kennel income through dog-world service work."
      />

      <ServiceMessages message={message} error={error} />

      <section className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <ServiceCard
          title="Club Stewarding"
          description="Claim stewarding assignments at local show weekends. Stewarding pays kennel income, but makes that show or cluster your primary show commitment."
          metadata={[
            `${openStewardingAssignments} available assignment${
              openStewardingAssignments === 1 ? "" : "s"
            }`,
            `Typical pay: ${formatMoney(1500)}-${formatMoney(3000)}`,
          ]}
          href="/kennel/services/stewarding"
          action="View Stewarding Assignments"
        />

        <GroomingAssistancePanel
          openJobs={groomingJobs.length}
          actionsUsed={groomingSummary.groomingActionsUsedThisWeek}
          actionLimit={groomingSummary.totalGroomingActionLimit}
        />
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        <ComingSoonCard
          title="Handling"
          description="Future handling work will support show-entry and ring-service opportunities."
        />
        <ComingSoonCard
          title="Training"
          description="Future training work will support long-term dog preparation systems."
        />
        <ComingSoonCard
          title="Socializing"
          description="Future socializing work will support practical kennel activity and dog development."
        />
      </section>
    </main>
  );
}
