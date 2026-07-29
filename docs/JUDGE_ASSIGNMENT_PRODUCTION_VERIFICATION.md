# Judge assignment production verification

The production build command in `apps/web/package.json` runs `prisma migrate deploy`, then `prisma generate`, then `next build`. It requires `DATABASE_URL`. The recurring GitHub Action remains the scheduler and authenticates with `SHOWRING_JOBS_BASE_URL` and `SHOWRING_JOBS_SECRET`.

Before deployment, confirm the show-entry maintenance pause is active and that Year 15 has no entries. Temporarily disable the scheduled trigger in the GitHub Actions UI during the deployment window; do not change the workflow file. This prevents overlap between migration, deploy, and the first controlled maintenance run.

1. Commit and push Stages 3-5.
2. Deploy through the normal production build, which applies the migration.
3. Confirm the app is healthy and the migration/table exist with the read-only command below.
4. Re-enable the GitHub Actions schedule or use its existing `workflow_dispatch` control for one maintenance run.
5. Record the command output and `ASSIGNMENT_FINGERPRINT` for a newly planned cluster.
6. Run maintenance a second time, rerun the command, and require an identical fingerprint.
7. Confirm the breed-block count has not changed, then leave GitHub Actions enabled. Stop before any Vercel Cron work.

Run from `apps/web` with production credentials only after deployment:

```powershell
pnpm verify:judge-assignments -- --cluster-id <cluster-id> --expected-days <2-or-4> --week-start-epoch <epoch> --before-block-count <count>
```

The command accepts only read-only arguments and issues only `SELECT` statements. `--before-block-count` is the count captured before the controlled maintenance run; it makes the no-new-breed-block check meaningful. The fingerprint contains each ShowDay ID, BIS judge ID, and ordered canonical group-to-judge assignments.

The route rejects requests without the configured bearer token. Confirm the GitHub secret and base URL are still configured by using the existing workflow dispatch; do not expose either value in logs.

Rollback: immediately disable the scheduled trigger in the GitHub Actions UI and re-enable the entry-maintenance pause if needed. Preserve assignment rows: they are historical scheduled data and should not be casually deleted. Use the verification output to identify malformed days, stop further maintenance, and revert application code if necessary without rewriting persisted plans. Investigate and repair data only in a separately approved maintenance stage.

Stage 6 may begin only after the migration/table checks, all assignment invariants, unchanged second-run fingerprint, no added breed blocks, application health, and scheduler authentication checks pass.
