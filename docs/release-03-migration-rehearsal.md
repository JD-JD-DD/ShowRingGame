# RELEASE-03 migration rehearsal runbook

**Known unrehearsed risk:** the complete operation has not been exercised end-to-end against an isolated PostgreSQL copy. RELEASE-03 remains **BLOCKED — PostgreSQL rehearsal not performed**. Source dependency audits and focused fixture tests passed, but do not constitute a PostgreSQL rehearsal. No migration defect is currently known.

RELEASE-03B concluded **ALL SCHEMA FIRST IS SAFE**. Legacy backfill placement relative to GEN-05 and later schema is **HISTORICAL_IMPLEMENTATION_ORDER_ONLY**: its logical dependency is GEN-02 → GEN-03 → legacy backfill, while all six pending schema migrations may be physically installed first.

This runbook applies to both an explicitly identified disposable rehearsal database and the later live between-shows maintenance operation. Do not run any write command until the database owner, environment, PostgreSQL version, source snapshot, recovery point, and disposal or recovery plan have been recorded. A remote URL whose safety is unknown is not an eligible rehearsal target.

## Audited release operations

| Step | Operation | Repository source |
| --- | --- | --- |
| 1 | GEN-02 Decimal phenotype schema | `apps/web/prisma/migrations/20260815120000_gen02_decimal_dog_phenotype/migration.sql` |
| 2 | GEN-03 genotype schema | `apps/web/prisma/migrations/20260815130000_gen03_legacy_genotype_persistence/migration.sql` |
| 3 | Legacy genotype initialization | `apps/web/scripts/initializeLegacyGenotypes.ts` |
| 4 | GEN-05 background schema | `apps/web/prisma/migrations/20260815140000_gen05_breed_genetic_background/migration.sql` |
| 5 | Registration reservations | `apps/web/prisma/migrations/20260816000000_add_dog_registration_reservation/migration.sql` |
| 6 | JUDGE-02 profile schema | `apps/web/prisma/migrations/20260816010000_add_breed_judging_profiles/migration.sql` |
| 7 | JUDGE-05 result-audit schema | `apps/web/prisma/migrations/20260816020000_add_breed_judging_result_audit/migration.sql` |
| 8 | BREED-03 canonical data | `apps/web/scripts/migrateCanonicalBreedData.ts` |
| 9 | JUDGE-02 profile import | `apps/web/scripts/importBreedJudgingProfiles.ts` |
| 10 | Final read-only verification | Use the recorded preservation snapshot plus canonical Breed/profile checks. |

The pre-Post-Invitational source boundary is commit `6456afbd2863761148377309d7cc338d6272f552` (`f2ee97f^`) with migration state through `20260813130000_add_kennel_run_kind_and_litter_provenance`.

## Phase 0 — Maintenance and preflight

Confirm the between-shows boundary, prior relevant show processing completion, production target identity, and that `judge-show-blocks`, `finalize-show-results`, `resolve-breeding-progress`, `maintain-show-schedule`, and `maintain-foundation-inventory` are idle. A full maintenance window is operationally preferred. Capture a recovery/backup point and a read-only preservation snapshot: migration state; counts for User, Kennel, Dog, Litter, Breed, shows, entries, results, and awards; Dog identity/registration/breed/parent/owner/phenotype fingerprints; and historical ShowResult/award/point/title fingerprints.

## Phase 1 — Physical schema installation

From `apps/web`, use the repository's normal schema operation:

```text
prisma migrate deploy
```

It must apply, in timestamp order, `20260815120000_gen02_decimal_dog_phenotype`, `20260815130000_gen03_legacy_genotype_persistence`, `20260815140000_gen05_breed_genetic_background`, `20260816000000_add_dog_registration_reservation`, `20260816010000_add_breed_judging_profiles`, and `20260816020000_add_breed_judging_result_audit`.

Stop immediately if a migration fails or migration history reports an unexpected pending/applied state. Do not run data operations. GEN-02 preserves values while transforming all ten Dog phenotype columns to `DECIMAL(8,6)`; schema migrations are not assumed reversible and require restore or forward-fix planning.

## Phase 2 — Data initialization and migration

From `apps/web`, the data-operation order is:

```text
tsx scripts/initializeLegacyGenotypes.ts
tsx scripts/initializeLegacyGenotypes.ts          # idempotency check
tsx scripts/migrateCanonicalBreedData.ts --dry-run
tsx scripts/migrateCanonicalBreedData.ts --apply
tsx scripts/migrateCanonicalBreedData.ts --verify
tsx scripts/importBreedJudgingProfiles.ts
tsx scripts/importBreedJudgingProfiles.ts         # idempotency check
```

Stop for a genotype reconstruction/phenotype mismatch, invalid genotype, unrecoverable backfill error, unexpected Breed code, identity conflict, unexpected code2 mutation, canonical mismatch, missing profile FK target, duplicate/ambiguous profile, invalid profile total, import failure, or wrong active profile count.

The backfill must complete before final application breeding traffic: GEN-08 fails on a parent without genotype/version. BREED-03 must finish and verify before profile import. The profile schema foreign key targets `Breed.code2`; the 54 new profile rows cannot be imported against the old 264-row Breed set. The expected clean-baseline reference is 318 Breeds, 54 inserts, 12 Group changes, one name correction, and zero code2 changes; an unexpected production preflight difference requires investigation rather than forced application. The canonical profile source contains 318 rows.

Legacy backfill can resume/re-run safely after partial completion. BREED-03 is transactional and idempotent; profile import is transactional, upsert-based, and idempotent.

## Phase 3 — Read-only verification

Verify 318 exact canonical Breed rows with no duplicate code2; valid `showring-genotype-v1` legacy Dogs whose reconstructed phenotype has not rerolled; 318 exact active current judging profiles with FK coverage; JUDGE-05 schema with legacy audit fields null and historical results unchanged; reservation schema/data protecting historic registrations; and no ShowResult, award, point, title, or other history rewrite. Previously generated shows may retain their old Group structure.

## Phase 4 — Final code deployment

Deploy final application code only after Phase 3 passes. The existing build runs `prisma migrate deploy && prisma generate && next build`; its migration step is expected to be a no-op after Phase 1. If it reports a migration expected to be already applied, stop and investigate rather than proceeding.

## Stop points and recovery

Stop before the next operation for any Decimal/genotype reconstruction mismatch, unexpected Breed code or identity conflict, incomplete profile foreign-key coverage, profile validation failure, or historical-result fingerprint change. Schema migrations are additive but require restore or forward-fix rather than an assumed down migration. The registration migration reserves existing Dog registrations and all issued Litter serial/order combinations with conflict-safe inserts. The legacy initializer and same-version profile import must be rerun only as their documented idempotency checks.

Expected changes are Prisma migration metadata; Dog Decimal/genotype fields; background, reservation, and profile tables; nullable ShowResult audit columns; and canonical Breed rows/fields. Historical gameplay and class tables must not otherwise change. Record per-step and total durations, then dispose of or restore the rehearsal database rather than selectively cleaning it.
