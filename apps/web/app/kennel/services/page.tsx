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
    <article className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-4 py-3 shadow-[var(--dog-shadow)] lg:col-span-2">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(8rem,0.75fr)_minmax(11rem,0.9fr)_minmax(10rem,0.85fr)] lg:items-center">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">
            Grooming Assistance
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--dog-copy)]">
            Accept outside grooming jobs from other kennels, improve dogs' coat
            condition, earn income, and build grooming experience.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--dog-border)] bg-white/[0.03] px-3 py-2">
          <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-emerald-200/80">
            Open Jobs
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--dog-heading)]">
            {openJobs} job{openJobs === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--dog-border)] bg-white/[0.03] px-3 py-2">
          <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-emerald-200/80">
            Weekly Actions
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--dog-heading)]">
            {actionsUsed} / {actionLimit} used
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
          <div className="rounded-xl border border-[var(--dog-border)] bg-white/[0.03] px-3 py-2 text-sm font-semibold text-[var(--dog-heading)]">
            {formatMoney(500)} per job
          </div>
          <Link
            href="/kennel/services/grooming"
            className="inline-flex justify-center rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500"
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
