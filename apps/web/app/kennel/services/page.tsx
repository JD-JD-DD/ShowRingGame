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
    <article className="rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-5 shadow-[var(--dog-shadow)]">
      <div>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-3 min-h-[4.5rem] text-sm leading-7 text-[var(--dog-copy)]">
          {description}
        </p>
      </div>

      <div className="mt-5 grid gap-2">
        {metadata.map((item) => (
          <div
            key={item}
            className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-2 text-sm font-semibold text-[var(--dog-heading)]"
          >
            {item}
          </div>
        ))}
      </div>

      <Link
        href={href}
        className="mt-5 inline-flex w-full justify-center rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
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
    <article className="rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-5 opacity-75">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <span className="rounded-full border border-[var(--dog-border)] bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--dog-copy)]">
          Coming later
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--dog-copy)]">
        {description}
      </p>
    </article>
  );
}

function GroomingAssistanceStrip({
  openJobs,
  actionsUsed,
  actionLimit,
}: {
  openJobs: number;
  actionsUsed: number;
  actionLimit: number;
}) {
  return (
    <Link
      href="/kennel/services/grooming"
      className="group flex flex-col gap-3 border-y border-[var(--dog-border)] bg-white/[0.03] px-4 py-3 text-sm transition hover:bg-white/[0.06] sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold text-white">
            Grooming Assistance
          </h2>
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">
            Status
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[var(--dog-copy)]">
          <span>
            {openJobs} open job{openJobs === 1 ? "" : "s"}
          </span>
          <span>
            Weekly actions: {actionsUsed} / {actionLimit}
          </span>
          <span>Pay: {formatMoney(500)} per job</span>
        </div>
      </div>
      <span className="shrink-0 text-xs font-semibold text-purple-100 transition group-hover:text-white">
        View Grooming Jobs
      </span>
    </Link>
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
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <ServicesHeader
        title="Work Board"
        description="Earn practical kennel income through dog-world service work."
        balance={kennel.balance}
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

        <GroomingAssistanceStrip
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
