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
    <main className="mx-auto max-w-7xl px-6 py-8">
      <ServicesHeader
        title="Club Stewarding"
        description="Claim stewarding assignments at local show weekends. Stewarding pays kennel income, but makes that show or cluster your primary show commitment."
        balance={kennel.balance}
        showWorkBoardLink
      />

      <ServiceMessages message={message} error={error} />

      <section className="theme-panel rounded-[28px] p-5">
        <div className="mb-5">
          <div>
            <p className="theme-label text-xs font-semibold uppercase tracking-[0.2em]">
              Club Stewarding
            </p>
            <h2 className="theme-heading mt-2 text-2xl font-semibold">
              Available Assignments
            </h2>
          </div>
          <div className="theme-status-warning mt-4 rounded-2xl px-4 py-3 text-sm leading-6">
            Taking a stewarding assignment makes that show/cluster your primary
            show commitment for the weekend. You cannot enter dogs in that show.
            Secondary shows in the same weekend may still be entered with
            traveling handlers where required.
          </div>
        </div>

        {opportunities.length === 0 ? (
          <div className="theme-card theme-copy rounded-2xl p-6 text-sm">
            No stewarding assignments are available right now.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {opportunities.map((opportunity) => (
              <article
                key={opportunity.showClusterId}
                className="theme-card rounded-2xl p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="theme-heading text-lg font-semibold">
                      {opportunity.name}
                    </h3>
                    <p className="theme-copy mt-1 text-sm">
                      {opportunity.districtName} District
                    </p>
                  </div>
                  <div className="theme-neutral-badge rounded-full px-3 py-1 text-sm font-semibold">
                    {formatMoney(opportunity.payoutAmount)}
                  </div>
                </div>

                <div className="theme-copy mt-4 grid gap-3 text-sm sm:grid-cols-4">
                  <div className="theme-card rounded-xl p-3">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Dates
                    </div>
                    <div className="theme-heading mt-1 font-semibold">
                      {formatDate(opportunity.startEpoch)}
                    </div>
                  </div>
                  <div className="theme-card rounded-xl p-3">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Days
                    </div>
                    <div className="theme-heading mt-1 font-semibold">
                      {opportunity.dayCount}
                    </div>
                  </div>
                  <div className="theme-card rounded-xl p-3">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Status
                    </div>
                    <div className="theme-heading mt-1 font-semibold">
                      {opportunity.alreadyStewarded
                        ? "Claimed"
                        : opportunity.availableSpaces > 0
                          ? "Open"
                          : "Full"}
                    </div>
                  </div>
                  <div className="theme-card rounded-xl p-3">
                    <div className="theme-label text-xs uppercase tracking-wide">
                      Spaces
                    </div>
                    <div className="theme-heading mt-1 font-semibold">
                      {opportunity.availableSpaces} / {opportunity.totalSpaces}
                    </div>
                  </div>
                </div>

                <p className="theme-copy mt-4 text-xs leading-5">
                  Stewarding pays {formatMoney(opportunity.payoutAmount)}, but
                  you cannot owner-handle dogs in this exact show/cluster. Each
                  kennel may hold one stewarding assignment per show weekend.
                </p>

                {opportunity.blockedReason ? (
                  <div className="theme-card theme-copy mt-4 rounded-xl px-3 py-2 text-sm">
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
                    className="theme-primary-button w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
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
