"use client";

import { useMemo, useState } from "react";

import { DEFAULT_ART_CAMPAIGN_FILTERS, filterArtCampaigns, getArtCampaignGroupOptions, ART_CAMPAIGN_STATUS_FILTER_OPTIONS } from "@/lib/artCampaignFilters";
import type { ArtCampaignReadDto, ArtCampaignStatusValue } from "@/server/services/artCampaign.service";

import ArtCampaignCard from "./ArtCampaignCard";

export default function BreedArtFundingBoardClient({ campaigns, creditKennelName }: { campaigns: ArtCampaignReadDto[]; creditKennelName?: string | null }) {
  const [filters, setFilters] = useState(DEFAULT_ART_CAMPAIGN_FILTERS);
  const groupOptions = useMemo(() => getArtCampaignGroupOptions(campaigns), [campaigns]);
  const filteredCampaigns = useMemo(() => filterArtCampaigns(campaigns, filters), [campaigns, filters]);
  const hasActiveFilters = filters.groupName !== "ALL" || filters.breedName.trim() !== "" || filters.status !== "ALL";
  const visibleCampaigns = hasActiveFilters ? filteredCampaigns : [];

  return <>
    <section className="theme-card mt-5 rounded-2xl p-4 sm:p-5" aria-label="Breed artwork filters">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="theme-label grid gap-1 text-sm" htmlFor="breed-art-group-filter">Group
          <select id="breed-art-group-filter" value={filters.groupName} onChange={(event) => setFilters((current) => ({ ...current, groupName: event.target.value }))} className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            <option value="ALL">All Groups</option>
            {groupOptions.map((groupName) => <option key={groupName} value={groupName}>{groupName}</option>)}
          </select>
        </label>
        <label className="theme-label grid gap-1 text-sm" htmlFor="breed-art-name-filter">Breed Name
          <input id="breed-art-name-filter" type="search" value={filters.breedName} onChange={(event) => setFilters((current) => ({ ...current, breedName: event.target.value }))} className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" />
        </label>
        <label className="theme-label grid gap-1 text-sm" htmlFor="breed-art-status-filter">Funding Status
          <select id="breed-art-status-filter" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value === "NEEDS_FUNDING" || event.target.value === "FUNDED" || event.target.value === "DRAWING_COMPLETE" ? event.target.value as ArtCampaignStatusValue : "ALL" }))} className="theme-control min-w-0 rounded-xl px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            {ART_CAMPAIGN_STATUS_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" onClick={() => setFilters(DEFAULT_ART_CAMPAIGN_FILTERS)} disabled={!hasActiveFilters} className="theme-secondary-button w-full rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60">Clear Filters</button>
        </div>
      </div>
      <p className="theme-copy mt-4 text-sm" aria-live="polite" aria-atomic="true">{hasActiveFilters ? `Showing ${new Intl.NumberFormat().format(filteredCampaigns.length)} breeds` : "Use the filters above to browse breed artwork campaigns."}</p>
    </section>

    {hasActiveFilters ? visibleCampaigns.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleCampaigns.map((campaign) => <ArtCampaignCard key={campaign.id} campaign={campaign} creditKennelName={creditKennelName} />)}</div> : <p className="theme-copy mt-5">No breeds match these filters.</p> : null}
  </>;
}
