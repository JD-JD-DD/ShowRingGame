# Database connection deployment

The web Prisma 6 configuration uses `DATABASE_URL` for Prisma Client and `DIRECT_URL` for Prisma CLI operations requiring a direct connection. Configure both for the same intended branch, database, role, and schema. Application jobs and scripts using Prisma Client or `pg` still use `DATABASE_URL`; they do not automatically use `DIRECT_URL`.

## Preparation

1. In a local untracked environment file, set `DATABASE_URL` to the Neon pooled connection and `DIRECT_URL` to the Neon direct connection for the intended non-production database. Use Neon-provided TLS parameters, including `sslmode=require` where supplied. Do not commit either value. A local non-pooled database may use the same direct URL for both variables.
2. Before enabling the change in Production, obtain the Neon pooled and direct connection strings for the same production branch and database. Verify the pooled hostname contains `-pooler` and the direct hostname does not. Preserve the provider's TLS parameters. Do not add `connection_limit` or `pool_timeout` as part of this change.
3. Neon supports protocol-level prepared statements through its transaction pooler. Prisma recommends leaving `pgbouncer=true` off with PgBouncer 1.21 or newer when prepared-statement tracking is enabled. Verify the current Neon pooler documentation and settings; for older poolers or without tracking, consult Prisma's PgBouncer guidance before deployment. Do not add the flag blindly.
4. If credentials need rotation, arrange valid replacement credentials for both endpoints and all consumers before revoking the old credentials. Do not revoke credentials used by the active deployment until the replacement deployment is healthy. If Neon rotation invalidates old credentials immediately, coordinate a maintenance window and update all dependent consumers together.

## Deploy and verify

1. In Vercel project settings, configure Production `DATABASE_URL` with the pooled string and Production `DIRECT_URL` with the direct string. Include the same variables in any other environment that builds this version. Changing variables affects new deployments; keep the currently working deployment and credentials available.
2. Only after environment setup, commit and push the reviewed changes when ready: pushing triggers production deployment. The existing web build runs `prisma migrate deploy` using `DIRECT_URL`, followed by `prisma generate` and `next build`. The migration step can apply pending migrations; check migration readiness and backups under the normal release procedure first.
3. Check the deployment build and migration logs for success without exposing URLs. Verify login, `/shows`, a representative read, and scheduled-job health through normal monitoring; do not run load tests. Check Neon pooled client/server metrics and Vercel logs for P2024, connectivity, and prepared-statement errors. Pooling does not eliminate the local Prisma pool or guarantee a P2024 fix.

## Rollback

If the deployment fails or smoke tests show a regression, restore the previous production deployment using Vercel's rollback mechanism. Confirm the restored deployment has a valid direct `DATABASE_URL` and still-valid credentials; redeploy with valid direct settings if its captured environment is no longer usable. Restore current Vercel environment settings to valid direct connection values for subsequent deployments. If credentials were revoked, issue valid replacements and update every dependent consumer; do not restore an invalid secret. Investigate before retrying.

## Administrative operations

Prisma migration, introspection, and other session-dependent tools require a direct connection. Existing application scripts read `DATABASE_URL` even when `DIRECT_URL` exists. For an approved operation that requires a direct connection, supply the direct URL as `DATABASE_URL` in that process only, verify the target, and follow the operation's own runbook. Review other maintenance scripts before using the pooler; do not assume session-dependent or long-running scripts are compatible.
