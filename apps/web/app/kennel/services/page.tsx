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
    <article className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
      <div>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-3 min-h-[4.5rem] text-sm leading-7 text-purple-100/75">
          {description}
        </p>
      </div>

      <div className="mt-5 grid gap-2">
        {metadata.map((item) => (
          <div
            key={item}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm font-semibold text-purple-100"
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
    <article className="rounded-[28px] border border-white/10 bg-black/20 p-5 opacity-75">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-100/70">
          Coming later
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-purple-100/65">
        {description}
      </p>
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

      <section className="grid gap-5 lg:grid-cols-2">
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

        <ServiceCard
          title="Grooming Assistance"
          description="Accept outside grooming jobs from other kennels, improve dogs' coat condition, earn income, and build grooming experience."
          metadata={[
            `${groomingJobs.length} open grooming job${
              groomingJobs.length === 1 ? "" : "s"
            }`,
            `Weekly grooming actions used: ${groomingSummary.groomingActionsUsedThisWeek} / ${groomingSummary.totalGroomingActionLimit}`,
            `Pay: ${formatMoney(500)} per job`,
          ]}
          href="/kennel/services/grooming"
          action="View Grooming Jobs"
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
