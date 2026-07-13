import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  KennelRenameError,
  renameKennel,
  validateKennelName,
} from "@/server/services/kennel.service";

type FakeKennel = {
  id: string;
  userId: string | null;
  isNpc: boolean;
  name: string;
  slug: string;
  moderationStatus: "ACTIVE" | "CLOSED";
  user: {
    moderationStatus: "ACTIVE" | "BANNED";
  } | null;
};

type FakeRenameHistory = {
  id: string;
  kennelId: string;
  previousName: string;
  previousSlug: string;
  newName: string;
  newSlug: string;
  source: "SELF_SERVICE" | "ADMIN";
  changedAt: Date;
};

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;

  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createFakeClient(seed?: {
  kennels?: FakeKennel[];
  renameHistory?: FakeRenameHistory[];
  failCreateHistory?: boolean;
}) {
  const state = {
    kennels: cloneState(seed?.kennels ?? []),
    renameHistory: cloneState(seed?.renameHistory ?? []),
    failCreateHistory: seed?.failCreateHistory ?? false,
  };
  let nextId = 1;

  function buildTx() {
    return {
      kennel: {
        async findFirst(args: {
          where: {
            id?: string | { not: string };
            userId?: string;
            slug?: string;
            name?: { equals: string; mode: "insensitive" };
          };
          select?: Record<string, unknown>;
        }) {
          const kennel = state.kennels.find((candidate) => {
            const idMatches =
              typeof args.where.id === "string"
                ? candidate.id === args.where.id
                : args.where.id?.not
                  ? candidate.id !== args.where.id.not
                  : true;
            const userMatches = args.where.userId
              ? candidate.userId === args.where.userId
              : true;
            const slugMatches = args.where.slug
              ? candidate.slug === args.where.slug
              : true;
            const nameMatches = args.where.name
              ? candidate.name.toLowerCase() ===
                args.where.name.equals.toLowerCase()
              : true;

            return idMatches && userMatches && slugMatches && nameMatches;
          });

          if (!kennel) {
            return null;
          }

          return {
            ...kennel,
          };
        },
        async update(args: {
          where: { id: string };
          data: { name?: string; slug?: string };
          select?: Record<string, unknown>;
        }) {
          const kennel = state.kennels.find(
            (candidate) => candidate.id === args.where.id
          );

          if (!kennel) {
            throw new Error("Kennel not found.");
          }

          if (args.data.name !== undefined) {
            kennel.name = args.data.name;
          }

          if (args.data.slug !== undefined) {
            kennel.slug = args.data.slug;
          }

          return {
            id: kennel.id,
            name: kennel.name,
            slug: kennel.slug,
          };
        },
      },
      kennelRenameHistory: {
        async findFirst(args: {
          where: {
            kennelId?: string | { not: string };
            source?: "SELF_SERVICE" | "ADMIN";
            OR?: Array<{ previousSlug: string } | { newSlug: string }>;
          };
          orderBy?: { changedAt: "desc" };
          select?: Record<string, unknown>;
        }) {
          let rows = state.renameHistory.filter((row) =>
            typeof args.where.kennelId === "string"
              ? row.kennelId === args.where.kennelId
              : args.where.kennelId?.not
                ? row.kennelId !== args.where.kennelId.not
                : true
          );

          rows = rows.filter((row) =>
            args.where.source ? row.source === args.where.source : true
          );

          if (args.where.OR) {
            rows = rows.filter((row) =>
              args.where.OR?.some((condition) =>
                "previousSlug" in condition
                  ? row.previousSlug === condition.previousSlug
                  : row.newSlug === condition.newSlug
              )
            );
          }

          rows.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
          return rows[0] ?? null;
        },
        async create(args: { data: Omit<FakeRenameHistory, "id" | "changedAt"> }) {
          if (state.failCreateHistory) {
            throw new Error("Injected history write failure");
          }

          const created: FakeRenameHistory = {
            id: `history-${nextId}`,
            changedAt: new Date(nextId),
            ...args.data,
          };
          nextId += 1;
          state.renameHistory.push(created);
          return created;
        },
      },
      ledgerTransaction: {},
    };
  }

  return {
    state,
    client: {
      async $transaction<T>(callback: (tx: never) => Promise<T>) {
        const snapshot = cloneState(state);

        try {
          return await callback(buildTx() as never);
        } catch (error) {
          state.kennels = snapshot.kennels;
          state.renameHistory = snapshot.renameHistory;
          state.failCreateHistory = snapshot.failCreateHistory;
          throw error;
        }
      },
    },
  };
}

async function expectRenameError(
  callback: () => Promise<unknown>,
  expectedCode: KennelRenameError["code"]
) {
  await assert.rejects(callback, (error: unknown) => {
    assert.ok(error instanceof KennelRenameError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

async function main() {
  const validation = validateKennelName("  New   Horizon  ");
  assert.equal(validation.ok, true, "valid kennel names are normalized");
  if (validation.ok) {
    assert.equal(validation.name, "New Horizon");
    assert.equal(validation.slugBase, "new-horizon");
  }

  const invalid = validateKennelName(" !");
  assert.equal(invalid.ok, false, "invalid names are rejected");
  if (!invalid.ok) {
    assert.equal(invalid.code, "INVALID_NAME");
  }

  const prohibited = validateKennelName("System");
  assert.equal(prohibited.ok, false, "reserved names are rejected");
  if (!prohibited.ok) {
    assert.equal(prohibited.code, "PROHIBITED_NAME");
  }

  const baseKennel: FakeKennel = {
    id: "kennel-1",
    userId: "user-1",
    isNpc: false,
    name: "Blue Cedar",
    slug: "blue-cedar",
    moderationStatus: "ACTIVE",
    user: {
      moderationStatus: "ACTIVE",
    },
  };

  const successFake = createFakeClient({
    kennels: [baseKennel],
  });
  const renamed = await renameKennel({
    client: successFake.client as never,
    userId: "user-1",
    newName: "Silver Maple",
  });
  assert.equal(renamed.id, "kennel-1", "kennel id remains unchanged");
  assert.equal(renamed.name, "Silver Maple");
  assert.equal(renamed.slug, "silver-maple");
  assert.equal(
    successFake.state.renameHistory.length,
    1,
    "first self-service rename writes one history row"
  );
  assert.equal(
    successFake.state.renameHistory[0]?.previousName,
    "Blue Cedar",
    "history captures the former kennel name"
  );

  await expectRenameError(
    () =>
      renameKennel({
        client: successFake.client as never,
        userId: "user-1",
        newName: "Second Chance",
      }),
    "RENAME_ALREADY_USED"
  );

  const adminHistoryFake = createFakeClient({
    kennels: [baseKennel],
    renameHistory: [
      {
        id: "admin-history",
        kennelId: "kennel-1",
        previousName: "Original",
        previousSlug: "original",
        newName: "Blue Cedar",
        newSlug: "blue-cedar",
        source: "ADMIN",
        changedAt: new Date(1),
      },
    ],
  });
  const adminHistoryRename = await renameKennel({
    client: adminHistoryFake.client as never,
    userId: "user-1",
    newName: "Autumn Vale",
  });
  assert.equal(
    adminHistoryRename.slug,
    "autumn-vale",
    "admin history does not consume the self-service allowance"
  );

  const duplicateFake = createFakeClient({
    kennels: [
      baseKennel,
      {
        ...baseKennel,
        id: "kennel-2",
        userId: "user-2",
        name: "Silver Maple",
        slug: "silver-maple",
      },
    ],
  });
  await expectRenameError(
    () =>
      renameKennel({
        client: duplicateFake.client as never,
        userId: "user-1",
        newName: "silver maple",
      }),
    "NAME_ALREADY_TAKEN"
  );

  await expectRenameError(
    () =>
      renameKennel({
        client: createFakeClient({ kennels: [baseKennel] }).client as never,
        userId: "user-1",
        newName: "  BLUE   CEDAR  ",
      }),
    "NO_ACTUAL_NAME_CHANGE"
  );

  await expectRenameError(
    () =>
      renameKennel({
        client: createFakeClient({ kennels: [baseKennel] }).client as never,
        userId: "user-2",
        kennelId: "kennel-1",
        newName: "Birch Hollow",
      }),
    "UNAUTHORIZED_OWNERSHIP"
  );

  await expectRenameError(
    () =>
      renameKennel({
        client: createFakeClient({
          kennels: [{ ...baseKennel, moderationStatus: "CLOSED" }],
        }).client as never,
        userId: "user-1",
        newName: "Birch Hollow",
      }),
    "MODERATION_RESTRICTED"
  );

  await expectRenameError(
    () =>
      renameKennel({
        client: createFakeClient({
          kennels: [
            {
              ...baseKennel,
              user: { moderationStatus: "BANNED" },
            },
          ],
        }).client as never,
        userId: "user-1",
        newName: "Birch Hollow",
      }),
    "MODERATION_RESTRICTED"
  );

  const atomicFake = createFakeClient({
    kennels: [baseKennel],
    failCreateHistory: true,
  });
  await assert.rejects(
    () =>
      renameKennel({
        client: atomicFake.client as never,
        userId: "user-1",
        newName: "Broken Save",
      })
  );
  assert.equal(
    atomicFake.state.kennels[0]?.name,
    "Blue Cedar",
    "kennel update rolls back if history creation fails"
  );
  assert.equal(
    atomicFake.state.renameHistory.length,
    0,
    "rename history also rolls back on failure"
  );

  const accountPage = source("apps/web/app/account/page.tsx");
  const accountComponent = source(
    "apps/web/components/account/KennelNameSettingsSection.tsx"
  );
  const kennelProfilePage = source("apps/web/app/kennels/[slug]/page.tsx");
  const renameRoute = source("apps/web/app/api/kennel/rename/route.ts");

  assertIncludes(
    renameRoute,
    'source: "SELF_SERVICE"',
    "rename route always uses the self-service source"
  );
  assertIncludes(
    renameRoute,
    'code: "UNAUTHORIZED_OWNERSHIP"',
    "rename route returns stable unauthorized ownership codes"
  );
  assertIncludes(
    kennelProfilePage,
    "permanentRedirect(`/kennels/${renamedKennel.kennel.slug}`)",
    "former kennel slugs permanently redirect to the current canonical slug"
  );
  assertIncludes(
    kennelProfilePage,
    "Previously known as:",
    "public kennel profile shows the former kennel name"
  );
  assertIncludes(
    accountPage,
    "hasUsedSelfServiceRename",
    "account page computes the self-service rename lockout state"
  );
  assertIncludes(
    accountComponent,
    "This self-service kennel name change can only be used once.",
    "account UI requires explicit one-time confirmation wording"
  );
  assertIncludes(
    accountComponent,
    "Self-service kennel renaming has already been used.",
    "account UI disables the form after the self-service rename is spent"
  );

  console.log("Kennel rename checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
