# Dog / Show Read-Model Field Contract Audit

## 1. Purpose

This read-only audit investigates ARCH-DEBT-006. It tests high-risk player-facing field contracts, not whether every page uses one query style. It does not impose a universal Dog or Show read layer and makes no runtime changes.

## 2. Accepted Read Architectures

The current repository supports four legitimate patterns:

- Next.js Server Components directly query Prisma and shape a surface-specific view.
- Services load and compose a domain read model, for example `getDogProfile` plus `dog.mapper.ts`.
- Mappers translate a selected record into a stable DTO.
- Shared helpers derive a narrow semantic/presentation fact from records already loaded.

Direct Prisma is not debt by itself. A finding requires a materially different meaning for the same player-facing fact, hidden-data exposure across the render/API boundary, historical-state confusion, or evidenced material read inefficiency.

## 3. High-Risk Field Contract Summary

| Concept | Current semantic source | Main consumers | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Dog name/title prefix/suffix | Dog display fields through `formatDogDisplayName`; semantic current title separately from `DogTitleProgress` | profile, market, studs, pedigree, results | title mirror/current-state distinction | retain title-prefix contract |
| Visible phenotype categories | `deriveCurrentVisibleCategoriesForDogDisplay` | profile, owned roster API, Market, Studs, planner/breeding | hidden stored traits are inputs | retain shared helper |
| Health label/severity | `dogHealth` helpers and public/latest test selections | profile, planner, Market, Studs, entry | local presentation differs by surface | retain helpers; no divergent rule found |
| Current show availability/status | `showAvailability.service` helpers | show detail/list and entry planner | entry window/workflow state | retain shared helper |
| Published result/award facts | `ShowResult` / `ShowAward` / GCH credit records | result pages, dog record, Ribbon Room | historical truth | retain event records as authority |
| Historical result dog names | current joined Dog display fields | show history/results/Ribbon Room | current-name versus event fact | intentional current presentation; no title snapshot exists |

## 4. Dog Read Surface Inventory

| Concept | Surface | Source location | Persistence inputs / helper | Output | Current or historical | Relationship / classification | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Identity/title | Dog profile | `dog.service:getDogProfile`, `dog.mapper.ts` | Dog fields, `formatDogDisplayName`, title progress | full profile header and semantic title panel | Current | shared mapper contract | High |
| Identity/title | public/owned Dog page | `app/dogs/[dogId]/page.tsx` | profile DTO | profile rendering | Current | SAFE LOCAL READ consumer | High |
| Identity/market state | owned Dog roster API | `app/api/dogs/mine/route.ts` | bounded Dog select, visible-category and health helpers | roster DTO | Current | surface-specific DTO | High |
| Identity/categories/health | Breeding planner | `components/breeding/BreedingPlannerPage.tsx` | selected stored traits are fed to shared visible-category helper | planning cards | Current | intentional planner variant | High |
| Identity/categories/health/stud state | Stud discovery | `app/studs/page.tsx`, `publicStud.service.ts` | direct bounded select, public health records, visible-category and breeding eligibility helpers | public Stud cards | Current | intentional public-market variant | High |
| Identity/categories/health/sale state | Market | `market.service:listMarketDogs` | listing + Dog fields, visible-category helper | market DTO | Current | shared semantic helper | High |
| Identity/title/health/progress | Program planner | `programPlanner.service.ts` | Dog, title/health/category helpers | owner planning DTO | Current | intentional planning variant | High |
| Pedigree identity/history | profile pedigree and litter mappers | `dog.service`, `litter.mapper.ts` | bounded generation queries, `formatDogDisplayName` | ancestor/puppy cards | Current Dog presentation over durable lineage | intentional historical/presentation variant | High |
| Show-entry availability | Dog show-entry planner | `dogShowEntryPlanner.service.ts`, `showEntry.service.ts` | canonical entry availability/eligibility services | actionable entry planner | Current | BUSINESS AUTHORITY consumer | High |
| Show record/Ribbon Room | `dog.service:listPublishedDogShowResults`, `ribbonRoom.service.ts` | result, award, GCH-credit records plus Dog name | career/history DTO | Historical facts + current Dog name | intentional variant | High |

## 5. Show Read Surface Inventory

| Concept | Surface | Source location | Persistence inputs / helper | Output | Current or historical | Relationship / classification | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cluster identity/calendar/status | Show list | `app/shows/page.tsx` | direct `ShowCluster` query, game clock, availability/display helpers | upcoming-window cards | Current | SAFE LOCAL READ | High |
| Cluster/day availability | Show detail | `app/shows/[showId]/page.tsx` | cluster/day/block rows plus `showAvailability.service` | entry state/messages and schedule | Current | shared semantic helper | High |
| Actionable dog availability | show entry planner | `dogShowEntryPlanner.service.ts` | canonical availability, entry service, eligibility rules | selectable dogs/days | Current | BUSINESS AUTHORITY consumer | High |
| Publication/results | results index and breed results | `app/shows/[showId]/results/*` | published result/award rows, entry status, judges | placement/award/points tables | Historical event facts | shared event-record contract | High |
| Invitational/history | Invitational and show history pages | direct results/award queries | cluster/year/award facts and joined Dog/kennel presentation | historical winners/history | Historical facts + current presentation | intentional variant | High |
| Dog career/Ribbon Room | dog/ribbon services | `ShowResult`, `ShowAward`, `DogGrandChampionCredit` | historical points/award displays | historical career view | Historical | shared event-record contract | High |

## 6. Hidden-Data Boundary Audit

No confirmed player-facing hidden-data exposure was found in the sampled major Dog/Show surfaces.

- Raw Dog traits and health-condition truth values are selected in server-only pages/routes to derive the five visible categories. The response/JSX shaping uses `deriveCurrentVisibleCategoriesForDogDisplay`; sampled roster and planner outputs expose the derived categories, not raw trait or genotype fields.
- `genotype` and `geneticsVersion` were not found in the sampled player DTO/select shapes. Raw genotype, RNG seeds, judge weights, and scoring formulas were not found crossing these render/API boundaries.
- Public Stud and Market paths select public health tests and purpose-limited health-condition inputs, then use shared presentation helpers. No private kennel notes, provider records, or private breeder notes were found in their public card DTOs.
- `breederNote` appears in the authenticated litter-management editor/mapper, an ownership-scoped workspace rather than a public Dog/Show surface.
- Support provider IDs appear only in sandbox/diagnostic/test-scoped paths, outside the audited public Dog/Show surfaces.

Static inspection cannot prove every client serialization path or authorization guard; those remain in Section 13.

## 7. Current vs Historical Presentation

`ShowResult`, `ShowAward`, published epochs, judges, points, majors, competition counts, and GCH credits are event-time facts. Results and history pages read those durable records rather than recomputing placements from current Dog state.

Dog name/title joins in historical results use current `visibleTitlePrefix`/suffix through the established Dog-name contract. ADR-0002 protects historical facts, while the title audit records that no event-time title-string snapshot exists. This is an intentional current-presentation join, not evidence that award facts are mutable or rerated.

## 8. Eligibility Presentation Audit

| Displayed fact | Surface | Classification | Evidence |
| --- | --- | --- | --- |
| Entry windows/status/messages | show list/detail/planner | BUSINESS AUTHORITY consumer | uses `showAvailability.service` rather than local epoch reconstruction |
| Dog selection for entry | entry planner | BUSINESS AUTHORITY consumer | delegates to entry/eligibility services and rules |
| Stud/breeding explanation | Studs/planner | PRESENTATION of canonical eligibility | uses breeding eligibility service/message; surface-specific wording/data remains local |
| Market/stud availability cards | Market/Studs | PRESENTATION plus listing-state read | listing/offer state is selected; no alternate mutation authority found |
| Entry-time versus judging-time rules | entry and judging surfaces | INTENTIONAL VARIANT | event-stage constraints differ by design and are not competing display calculations |

No presentation path was found authorizing an action or independently replacing a server mutation rule.

## 9. Shared Semantic Helper Inventory

| Concept | Helper | Consumers | Semantic role | Further safe reuse |
| --- | --- | --- | --- | --- |
| Dog name/title presentation | `formatDogDisplayName` | profile, Market, Studs, pedigree, results, notices | formats persisted display fields | Yes, where rendering a Dog name |
| Current title compatibility | `dogTitles` helpers | GCH, Prestige, contracts, planner | Champion-of-record semantics with legacy compatibility | Yes; do not replace title-prefix contract |
| Visible phenotype categories | `deriveCurrentVisibleCategoriesForDogDisplay` | profile, roster, Market, Studs, breeding/planner | derives player-safe visible categories | Yes; high-value shared semantic contract |
| Health labels/severity | `dogHealth` helpers | profile, planner, entry, prestige | label/status interpretation | Yes, within health presentation |
| Show availability/display | `showAvailability.service` | show pages/planner | canonical entry/status windows | Yes; high-value shared semantic contract |
| Award/status labels | `showAwards`, `showEntryAbsence`, calendar/time helpers | result/history/profile pages | presentation formatting | Yes, where the same labels are rendered |

## 10. Performance / N+1 Audit

No confirmed material N+1 issue was found in the sampled high-risk paths.

- `getDogProfile` uses bounded relation reads, a four-generation batched pedigree loop, and `Promise.all` for independent secondary loads.
- owned Dog roster, Studs, Market, and breeding planner collect Dog IDs and use set/batch health truth enrichment rather than one query per rendered Dog.
- Community Support/prestige enrichment retains batched Set/Map patterns; ARCH-DEBT-005 has separately resolved the Support semantic boundary.
- Show list/detail direct Prisma reads use relation selects/counts appropriate to their distinct cards and tables. A direct Server Component query is not itself overfetch evidence.

Static inspection did not measure production cardinality or query plans; no performance remediation is proposed.

## 11. Confirmed Safe Variants

- `getDogProfile` is a rich profile contract, not a required universal replacement for roster, Market, Stud, planner, or pedigree DTOs.
- direct Prisma Show list/detail reads legitimately shape availability, schedule, and result-summary fields for their pages.
- Market, Stud, and planner read different public/owner/action context but share visible-category and health semantics where that fact overlaps.
- historical award/result pages may join current Dog names while preserving event-time result facts.
- local status tones, card ordering, counts, and labels are presentation variants unless they recalculate a protected business fact.

## 12. Confirmed Drift Findings

No confirmed same-fact semantic drift, hidden-data exposure, historical-interpretation defect, or material N+1 issue met the finding standard. Therefore no temporary `READ-AUDIT-*` finding is created.

## 13. Unknowns

- Static source review cannot verify live production row cardinalities, query plans, or cache behavior.
- Client serialization/authorization was sampled at the API/DTO/render boundary but was not dynamically exercised for every route.
- The intended product promise for showing a Dog’s current title on historical result pages remains covered by the existing title-prefix contract, not an event-time title snapshot.
- The audited surfaces do not establish a universal owner/public health-detail policy beyond their current selected fields.

## 14. ARCH-DEBT-006 Recommendation

**C. NO CANONICALIZATION REQUIRED.** The audited high-risk facts already have narrow shared semantic helpers or durable event records where required. The remaining direct Prisma and surface-specific service/mapper reads are intentional view shaping, not a competing Dog/Show read authority. ARCH-DEBT-006 should remain open only if a future field-specific report demonstrates a concrete semantic, exposure, historical, or performance defect; no broad read-layer consolidation is justified.

### Explicit Answers

1. No. Direct Prisma use by Server Components is an accepted read architecture.
2. No. `getDogProfile` is a strong rich-profile precedent, not a universal Dog read path.
3. No confirmed exposure was found in the sampled player-facing boundaries.
4. Yes. Audited category surfaces use `deriveCurrentVisibleCategoriesForDogDisplay`.
5. No material inconsistent interpretation was found; shared health helpers/public-test selection cover overlapping facts.
6. Yes. Name surfaces use display prefix/suffix, while semantic current-title surfaces use `DogTitleProgress`, per the title-prefix contract.
7. No. Audited Show facts use durable result/award/credit records; current Dog-name joins are intentional presentation.
8. Yes. Audited actionable status paths use `showAvailability.service`; result pages consume persisted publication state.
9. No confirmed material N+1 or major overfetch issue was found.
10. Visible categories, Dog names/title compatibility, health interpretation, show availability, and award labels require narrow shared helpers; pages may retain independent queries.
11. Profile versus card DTOs, direct Show reads, owner/public health context, and historical current-name joins are intentional surface variants.
12. Yes, pending a concrete future field-level defect; this audit does not support a broad canonicalization.
