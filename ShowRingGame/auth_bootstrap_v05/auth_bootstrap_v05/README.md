# ShowRing Game v0.5 — Step 1: Auth + Kennel Bootstrap

This package gives you the first shipping slice from `PlanforToday.docx`:

1. sign up
2. log in
3. persistent session cookie
4. kennel onboarding
5. starter funds
6. `/api/me`, `/api/kennel/me`

## Assumptions

- Next.js App Router
- Prisma Client available from `@prisma/client`
- PostgreSQL already connected through `DATABASE_URL`
- You can add these packages:

```bash
pnpm add bcryptjs jose zod @prisma/client
pnpm add -D prisma
```

## Required env vars

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=replace-with-long-random-string
STARTER_FUNDS=25000
DEFAULT_HOME_DISTRICT=4
```

## Important schema blockers found

Your uploaded `schema.prisma` cannot migrate cleanly in its current form because of several unrelated issues outside auth:

- `User` has no `passwordHash`
- `Kennel` has no `balance`
- `BreedingAttempt.createdEpoch Int @default(now())` is invalid
- several `Breed` relations reference `id` even though `Breed.code2` is the primary key
- `ShowResult` references `breedId` even though the field present is `breedCode2`

So for **Step 1**, the smallest safe schema move is:

- add `passwordHash` to `User`
- add `balance` to `Kennel`
- keep the rest of the larger schema cleanup as a separate pass before the next migration

## Suggested immediate migration

Use the patch in `schema_step1_patch.prisma` as the first-step reference, or manually apply the changes shown there to your real schema.
