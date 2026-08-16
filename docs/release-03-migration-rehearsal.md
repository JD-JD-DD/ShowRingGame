# RELEASE-03 migration rehearsal runbook

This runbook is for an explicitly identified disposable PostgreSQL database only. Do not run any write command below until the database owner, environment, PostgreSQL version, source snapshot, and disposal plan have been recorded. A remote URL whose safety is unknown is not an eligible rehearsal target.

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

## Required sequence

Record a preservation snapshot before step 1: migration state; counts for User, Kennel, Dog, Litter, Breed, shows, entries, results, and awards; Dog identity/registration/breed/parent/owner/phenotype fingerprints; and historical ShowResult/award/point/title fingerprints.

Apply schema steps individually, stopping for verification after each: 1, 2, run step 3, then 4, 5, 6, and 7. Do not replace this order with one `prisma migrate deploy` invocation: Prisma would apply all pending schema migrations before the required legacy-genotype data operation.

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

Step 8 must complete and verify before step 9. The profile schema foreign key targets `Breed.code2`; the 54 new profile rows cannot be imported against the old 264-row Breed set.

## Stop points and recovery

Stop before the next operation for any Decimal/genotype reconstruction mismatch, unexpected Breed code or identity conflict, incomplete profile foreign-key coverage, profile validation failure, or historical-result fingerprint change. Schema migrations are additive but require restore or forward-fix rather than an assumed down migration. The registration migration reserves existing Dog registrations and all issued Litter serial/order combinations with conflict-safe inserts. The legacy initializer and same-version profile import must be rerun only as their documented idempotency checks.

Expected changes are Prisma migration metadata; Dog Decimal/genotype fields; background, reservation, and profile tables; nullable ShowResult audit columns; and canonical Breed rows/fields. Historical gameplay and class tables must not otherwise change. Record per-step and total durations, then dispose of or restore the rehearsal database rather than selectively cleaning it.
