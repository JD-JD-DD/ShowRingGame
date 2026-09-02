# ShowRing Repository System Map

## 1. Purpose

This is a Stage 1 topology map of where major ShowRing implementation layers exist. It does not assign final domain ownership, determine canonical rules, or classify duplication or drift. Later stages will refine those questions. The Master File remains design authority; this map records current repository structure and visible implementation paths.

## 2. Repository Overview

```text
showringgame/
├─ apps/
│  └─ web/                 Next.js application, API handlers, services, Prisma, scripts
├─ packages/
│  └─ rules/               shared TypeScript rules package
├─ docs/                   product and engineering documentation
├─ scripts/                root seed and focused judging utility
├─ package.json            pnpm workspace root
├─ pnpm-workspace.yaml     apps/* and packages/* workspace boundaries
└─ prisma.config.ts        root Prisma configuration (references root paths not present in this checkout)
```

`apps/web` is the `web` workspace and depends on `@showring/rules` through the workspace protocol. It contains its own Prisma schema, migrations, and Prisma configuration. Root package metadata also declares a Prisma configuration, but its referenced `prisma/` paths were not found; the active application-local Prisma layout is the one visible from the web workspace.

## 3. Runtime / Application Flow

Actual code supports more than one read/write path:

```text
Browser
  ├─ Next.js server pages/components ──┬─ services ──┬─ @showring/rules
  │                                    │              └─ Prisma → PostgreSQL
  │                                    └─ direct Prisma reads
  └─ client components → /api route handlers → services/helpers → rules and/or Prisma

Vercel Cron → /api/cron or /api/jobs handlers → services/helpers → Prisma
PayPal → /api/webhooks/paypal → payment services → Prisma
```

For example, the `/shows` server page imports both services/rules helpers and `lib/db` for direct Prisma queries. The finalization cron route invokes `publishShowResultsJob.service`; the emergency-vet job invokes emergency-care and reproductive-emergency services. This is a topology observation only, not an ownership or quality judgment.

## 4. Architectural Layer Map

| Layer | Primary locations | Role | Representative landmarks |
| --- | --- | --- | --- |
| Workspace | root, `apps/web`, `packages/rules` | pnpm workspace and package boundaries | `package.json`, `pnpm-workspace.yaml` |
| Web application | `apps/web/app`, `components` | Next.js pages, layouts, client/server UI | `app/layout.tsx`, shows, kennel, dogs, litters |
| HTTP API | `apps/web/app/api` | route handlers for player actions, reads, jobs, and integrations | dogs, shows, kennel, cron, jobs, webhooks |
| Server services | `apps/web/server/services` | application orchestration and persistence-facing operations | breeding, judging, lifecycle, support, art payments |
| Mappers | `apps/web/server/mappers` | named DTO/presentation mapping | dog, litter, and show mappers |
| Shared helpers | `apps/web/lib` | infrastructure, sessions, time, formatting, request helpers | `db.ts`, `gameClock.ts`, `session.ts`, `http.ts` |
| Shared rules | `packages/rules` | TypeScript engines, constants, pure helpers, rule test tooling | `engines/`, `constants/`, `src/index.ts` |
| Persistence | `apps/web/prisma` | Prisma schema, migrations, seeds, static data | `schema.prisma`, `migrations/`, `seed.ts` |
| Scheduled work | `app/api/cron`, `app/api/jobs`, `apps/web/vercel.json` | authorized route-driven maintenance and progression | judging, results, breeding, payments, emergencies |
| Scripts and validation | `apps/web/scripts`, `packages/rules/src/test*.ts`, `scripts` | focused regression, auditing, maintenance, and seed utilities | 247 web `test*` scripts; rules package test scripts |

## 5. Next.js Pages and Route Groups

The App Router lives under `apps/web/app`, with shared `layout.tsx`, global CSS, and a `(public)` route group for login, signup, and password reset. Major player-facing areas include kennel and public kennel views, dogs, litters, breeding/planning, stud offers/contracts, market, shows/results, judges, districts/travel map, support, breed-art, account settings, ledger, notices/inbox/messages, bulletin/community, and guides/onboarding.

Separate operational areas include `admin` pages for system broadcasts, `test/support-sandbox`, and route areas such as `debug` and `test` under the API tree. Shared layout components are concentrated in `components/layout`; domain UI is grouped by feature such as dogs, kennel, litters, shows, breeding, stud-contract, support, art, community, and messages.

## 6. API Route Families

`apps/web/app/api` is organized primarily by resource or operation family:

- player and game operations: `dogs`, `litters`, `breedings`, `shows`, `show-entries`, `market-dogs`, `stud-listings`, `stud-contracts`, `stud-contract-puppy-selection`, and `stud-contract-return-services`;
- kennel and service operations: `kennel`, `services`, `foundation-dogs`, `breeds`, `me`, `account`, and `auth`;
- player communication and display data: `inbox`, `notices`, `bulletin`, and `community`;
- payments/support/art: `support`, `art-campaigns`, `art-payments`, and `webhooks/paypal`;
- administration and non-player operational surfaces: `admin`, `cron`, `jobs`, `debug`, and `test`.

The map intentionally does not enumerate every leaf handler.

## 7. Server Service Layer

`apps/web/server/services` contains feature-oriented service modules. Visible landmarks include account/auth; breeds and genetic background; dogs, registration, naming, lifecycle, health, emergency care, and rehoming; breeding, litters, public stud offers, and stud-contract lifecycle; shows, schedule, entries, judging, results publishing, titles, prestige, and invitationals; kennels, runs, notices, messaging, and moderation; grooming and other kennel services; market/economy; support subscriptions and PayPal; and breed-art campaigns/payments.

There are also operational and persistence-oriented services such as schedule migration/repair, kennel-run backfill, annual point-schedule build/resolution, judging audit, and canonical breed data migration. These are landmarks, not classifications of authority.

## 8. Mapper / DTO / Presentation-Building Layer

A dedicated mapper directory exists at `apps/web/server/mappers` with `dog.mapper.ts`, `litter.mapper.ts`, and `show.mapper.ts`. The codebase also has presentation-specific helpers in `apps/web/lib` (for example, award, support, phenotype, stud-offer, and show-calendar presentation helpers), and feature-local DTO/read-model construction in pages and services. DTO and presentation construction is therefore distributed in addition to the named mapper layer; this is a neutral topology observation.

## 9. Shared Library Layer

`apps/web/lib` provides shared infrastructure and cross-feature helpers. Notable areas include:

- persistence and request infrastructure: `db.ts`, `http.ts`, `requestAudit.ts`, guards, IDs, and performance helpers;
- authentication/session/account support: `auth.ts`, `session.ts`, `sessionToken.ts`, password-reset helpers, and `appBaseUrl.ts`;
- game time: `gameClock.ts`, `gameTimeFormat.ts`, countdowns, and timestamp formatting;
- gameplay-adjacent formatting/presentation: dog names/titles/health, phenotype formatting, awards, visibility, money, show labels, and stud/support presentation;
- operational authorization: `jobAuthorization.ts` and moderation helpers.

## 10. Rules Package

`packages/rules` is an ESM TypeScript workspace package exporting from `src/index.ts`. Its `engines/` directory contains high-level pure-rule families for annual championship schedules, breeding, clock/time, conditioning, COI, dog traits, economy, foundation dogs, genotype/genetics, grand championships, health, judging, litters, presentation, reproductive emergencies, and show calendars. `constants/` groups breed, training, time, calendar, lifecycle, judging, health, geography, genetics, economy, litter, and release configuration.

Other pure/helper areas include time, lifecycle, geography, show-weekend construction, show groups, seeded randomness, judge roster, and stud-contract terms. Package-local `test*.ts` files, an audit utility, calibration constants, a simulation directory, and genetics calibration/simulation runners provide focused validation and simulation tooling. The package’s public entrypoint re-exports engines, constants, and selected helpers.

## 11. Persistence Layer

The active schema is `apps/web/prisma/schema.prisma`; migrations are under `apps/web/prisma/migrations`, with web-local seed and static data files alongside them. Prisma declares PostgreSQL as its datasource. Major persisted families visible in the schema are:

- accounts, access, moderation, password-reset, kennels, and kennel history;
- breeds, breed judging profiles, genetic snapshots, dogs, dog notes/runs/planner tags, and mortality state;
- breeding attempts, litters, show clusters/days/blocks/entries/results/awards, title/prestige credits, and annual point schedules;
- economy, service claims, grooming, condition events, emergency care, reproductive emergencies, sales listings, and stud offers/contracts;
- bulletin/community, notices, conversations, blocks, and communication reports;
- support subscriptions/provider events and breed-art campaigns, contributions, payment attempts/events, and completed art.

## 12. Scheduled and Background Work

Scheduling is route-driven and Vercel Cron is visibly configured in `apps/web/vercel.json`. Configured paths include mortality resolution, show-block judging, show-result finalization, breeding progression, stud-contract lifecycle processing, art-payment reconciliation and replay, emergency-vet processing, and show-schedule maintenance. Handlers use cron/job authorization checks and call services where traceable.

| Entry family | Broad purpose | Readily visible service path |
| --- | --- | --- |
| `api/cron/resolve-dog-mortality` | due mortality progression | `lifecycle.service` |
| `api/cron/judge-show-blocks`, `finalize-show-results` | judging and publication/finalization | `showJudgingJob.service`, `publishShowResultsJob.service` |
| `api/cron/resolve-breeding-progress` | due breeding resolution | `breeding.service` |
| `api/cron/process-stud-contract-lifecycle` | contract deadlines/transfers/reconciliation | `studContractLifecycle.service` |
| `api/cron/reconcile-art-payments`, `replay-art-payment-events` | payment reconciliation/replay | art-payment runner services |
| `api/jobs/process-emergency-vet-care` | emergency and reproductive-event expiry/processing | emergency-care and reproductive-emergency services |
| `api/jobs/maintain-show-schedule` | schedule generation/maintenance | `showSchedule.service` |

Additional cron/job handlers are present for due-show judging, foundation inventory, grooming decay, and publishing show results. Their deployment invocation is **UNKNOWN** from the checked-in Vercel configuration alone; presence of a handler does not establish that it is scheduled. These jobs are distinct from the repository’s regression and maintenance scripts.

## 13. Scripts and Regression Infrastructure

`apps/web/scripts` contains a large focused TypeScript script suite (286 files observed, including 247 `test*` files). Web package scripts invoke individual `tsx` validation scripts rather than exposing one conventional aggregate test command. Visible groups include regression validation for player/game flows, support and PayPal, shows/judging, litter/breeding/stud contracts, health, kennel operations, and breed art; read-only audits and verification; seeds/snapshots; repair, backfill, migration/cutover, cleanup, and development/moderation utilities.

`packages/rules` separately exposes focused `tsx` test, simulation, and audit commands for pure rules. Root `scripts/` contains a seed utility and a judging test. No conventional test-framework configuration was established from the inspected package metadata; this is **UNKNOWN** rather than a claim that none exists anywhere.

## 14. External Integrations

| Integration | Primary location | Broad purpose |
| --- | --- | --- |
| PayPal | `app/api/webhooks/paypal`, payment/support services | verifies webhook events and processes support and art-payment activity |
| Resend | `lib/passwordResetEmail.ts` | optional password-reset email delivery through Resend’s email API |
| Vercel Cron | `apps/web/vercel.json` | invokes configured scheduled HTTP endpoints |
| Vercel Analytics / Speed Insights | `apps/web/package.json`, `app/layout.tsx` | packages are declared; Speed Insights import is currently commented out, and active runtime use of either is **UNKNOWN** from inspected code |
| PostgreSQL via Prisma | `apps/web/prisma/schema.prisma`, `lib/db.ts` | application persistence |

No secrets or environment-variable values are recorded here.

## 15. Major Shared Component Families

`apps/web/components` is grouped by gameplay/UI area. Significant reusable families include dogs (profile, health, pedigree, sale and breeding controls), kennel (roster, runs, bulk actions, services), litters (cards and puppy-management workspaces), shows (judge panels and countdowns), breeding and stud-contract flows, support and art-payment UI, awards/ribbon-room display, community/bulletin/messages/notices, account/admin controls, and shared layout/UI primitives. These families are used to assemble the corresponding App Router surfaces.

## 16. Initial System Diagram

```text
Browser
  ├─ App Router server pages ─┬─ lib helpers / services ─┬─ @showring/rules
  │                           │                          └─ Prisma → PostgreSQL
  │                           └─ direct Prisma reads
  └─ client components → API route handlers → services/helpers → rules and/or Prisma

Vercel Cron → cron/job route handlers → services/helpers → Prisma
PayPal webhook → webhook route → PayPal/art-payment services → Prisma
Resend password reset helper → Resend email API
```

## 17. Topology Observations for Later Stages

- Dedicated dog, litter, and show mappers coexist with distributed feature-local DTO and presentation construction.
- Some server pages read Prisma directly while also using services and rules helpers.
- Scheduled work is represented through both `api/cron` and `api/jobs` route families; only a subset is visible in checked-in Vercel Cron configuration.
- Gameplay-related logic is structurally distributed across rules engines/constants, server services, shared library helpers, route handlers, and presentation layers.
- The root Prisma configuration references root paths absent from this checkout, while the web workspace contains a complete local Prisma schema and migrations layout.

## 18. Unknowns

- **UNKNOWN:** deployment scheduling or other invocation mechanisms for cron/job handlers not listed in `apps/web/vercel.json`.
- **UNKNOWN:** whether a conventional test framework configuration exists outside the inspected package metadata and focused TypeScript harnesses.
- **UNKNOWN:** whether declared Vercel analytics packages are active at runtime; the inspected Speed Insights import is commented out.
- **UNKNOWN:** why the root Prisma configuration points to absent root `prisma/` paths, or whether it is used by another environment.

No individual implementation has been classified in this Stage 1 map.
