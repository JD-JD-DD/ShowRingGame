import { getCurrentEpoch } from "@/lib/gameClock";
import { listStewardingOpportunities } from "@/server/services/kennelService.service";
import {
  firstQueryValue,
  formatDate,
  formatMoney,
  getKennelServicesContext,
  ServiceMessages,
  ServicesHeader,
  type ServicesSearchParams,
} from "../shared";

type PageProps = {
  searchParams?: Promise<ServicesSearchParams>;
};

export default async function StewardingServicesPage({
  searchParams,
}: PageProps) {
  const { kennel } = await getKennelServicesContext();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const message = firstQueryValue(resolvedSearchParams.message);
  const error = firstQueryValue(resolvedSearchParams.error);
  const currentEpoch = getCurrentEpoch();
  const opportunities = await listStewardingOpportunities({
    kennelId: kennel.id,
    currentEpoch,
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 text-white">
      <ServicesHeader
        title="Club Stewarding"
        description="Claim stewarding assignments at local show weekends. Stewarding pays kennel income, but makes that show or cluster your primary show commitment."
        balance={kennel.balance}
        showWorkBoardLink
      />

      <ServiceMessages message={message} error={error} />

      <section className="rounded-[28px] border border-[var(--dog-border)] bg-[var(--dog-card)] p-5 shadow-[var(--dog-shadow)]">
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
          <div className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-6 text-sm text-[var(--dog-copy)]">
            No stewarding assignments are available right now.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {opportunities.map((opportunity) => (
              <article
                key={opportunity.showClusterId}
                className="rounded-2xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {opportunity.name}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--dog-copy)]">
                      {opportunity.districtName} District
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                    {formatMoney(opportunity.payoutAmount)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-[var(--dog-copy)] sm:grid-cols-4">
                  <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                      Dates
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {formatDate(opportunity.startEpoch)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                      Days
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {opportunity.dayCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
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
                  <div className="rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--dog-label)]">
                      Spaces
                    </div>
                    <div className="mt-1 font-semibold text-white">
                      {opportunity.availableSpaces} / {opportunity.totalSpaces}
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs leading-5 text-[var(--dog-copy)]">
                  Stewarding pays {formatMoney(opportunity.payoutAmount)}, but
                  you cannot owner-handle dogs in this exact show/cluster. Each
                  kennel may hold one stewarding assignment per show weekend.
                </p>

                {opportunity.blockedReason ? (
                  <div className="mt-4 rounded-xl border border-[var(--dog-border)] bg-[var(--dog-card)] px-3 py-2 text-sm text-[var(--dog-copy)]">
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
                  <input
                    type="hidden"
                    name="returnTo"
                    value="/kennel/services/stewarding"
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
    </main>
  );
}
