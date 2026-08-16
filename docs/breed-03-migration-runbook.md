# BREED-03 canonical Breed data migration

`apps/web/scripts/migrateCanonicalBreedData.ts` is a controlled TypeScript data migration. It synchronizes only `Breed.name`, `Breed.groupName`, `Breed.isActive`, and `Breed.releaseVersion`, keyed by immutable `Breed.code2`. It contains no delete path and does not update Dogs, litters, registrations, judging profiles, shows, results, awards, or any other relation.

Run it only after earlier branch schema migrations (including the JUDGE-02 schema migration) have succeeded. It does not require judging-profile rows to be imported.

Commands are run from `apps/web`:

```text
tsx scripts/migrateCanonicalBreedData.ts --dry-run
tsx scripts/migrateCanonicalBreedData.ts --verify
tsx scripts/migrateCanonicalBreedData.ts --apply
```

Dry-run is the default and read-only. Verify is read-only and fails if any canonical field differs, an unexpected database-only code exists, or a code/name identity conflict is found. Apply is explicit, transactional, and performs a postflight verify. It can technically affect whatever `DATABASE_URL` selects; production use is an operational decision and must occur between shows only after a reviewed dry-run and backup.

Before a production apply, export a Breed snapshot, retain the exact `0a76d0f^` baseline and dry-run output, and record inserted codes plus changed fields. Recovery is an operational restore or carefully reviewed reversal of only canonical Breed fields. Do not blindly roll back Group values once fresh shows have adopted the new Groups; historical/pre-generated shows intentionally retain their prior structures.
