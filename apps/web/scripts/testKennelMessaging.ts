import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  KennelMessagingError,
  MAX_KENNEL_MESSAGE_LENGTH,
  canonicalizeKennelPair,
  findKennelConversation,
  getOrCreateKennelConversation,
  loadKennelConversationHistory,
  sendKennelMessage,
} from "@/server/services/kennelMessaging.service";

type FakeKennel = {
  id: string;
  name: string;
  slug: string;
  userId: string | null;
  isNpc: boolean;
  moderationStatus: "ACTIVE" | "CLOSED";
  user: { moderationStatus: "ACTIVE" | "BANNED" } | null;
};

type FakeConversation = {
  id: string;
  firstKennelId: string;
  secondKennelId: string;
};

type FakeParticipant = {
  conversationId: string;
  kennelId: string;
  hiddenAt: Date | null;
};

type FakeMessage = {
  id: string;
  conversationId: string;
  senderKennelId: string;
  body: string;
  createdAt: Date;
};

function source(path: string): string {
  const cwd = process.cwd();
  const root = cwd.endsWith(`${join("apps", "web")}`) ? join(cwd, "..", "..") : cwd;
  return readFileSync(join(root, path), "utf8");
}

function createFakeClient(seed: { kennels: FakeKennel[]; raceOnFirstCreate?: boolean }) {
  const state = {
    kennels: seed.kennels,
    conversations: [] as FakeConversation[],
    raceConversations: [] as FakeConversation[],
    participants: [] as FakeParticipant[],
    messages: [] as FakeMessage[],
  };
  let nextId = 1;
  let racePending = seed.raceOnFirstCreate ?? false;

  const findConversation = (where: Record<string, unknown>) => {
    const rows = [...state.conversations, ...state.raceConversations];
    if (typeof where.id === "string") return rows.find((row) => row.id === where.id) ?? null;
    const pair = where.firstKennelId_secondKennelId as
      | { firstKennelId: string; secondKennelId: string }
      | undefined;
    return rows.find(
      (row) => row.firstKennelId === pair?.firstKennelId && row.secondKennelId === pair?.secondKennelId
    ) ?? null;
  };

  const client = {
    kennel: {
      async findMany(args: { where: { id: { in: string[] } } }) {
        return state.kennels.filter((kennel) =>
          args.where.id.in.includes(kennel.id) &&
          !kennel.isNpc &&
          kennel.userId !== null &&
          kennel.moderationStatus === "ACTIVE" &&
          kennel.user?.moderationStatus === "ACTIVE"
        );
      },
    },
    kennelConversation: {
      async findUnique(args: { where: Record<string, unknown>; select?: unknown }) {
        const conversation = findConversation(args.where);
        if (!conversation) return null;
        if (!args.select) return conversation;
        const kennel = (id: string) => state.kennels.find((candidate) => candidate.id === id)!;
        return {
          id: conversation.id,
          firstKennel: kennel(conversation.firstKennelId),
          secondKennel: kennel(conversation.secondKennelId),
          messages: state.messages
            .filter((message) => message.conversationId === conversation.id)
            .sort((left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id)
            )
            .map((message) => ({
              id: message.id,
              body: message.body,
              createdAt: message.createdAt,
              senderKennel: kennel(message.senderKennelId),
            })),
        };
      },
      async create(args: { data: { firstKennelId: string; secondKennelId: string } }) {
        const conversation: FakeConversation = { id: `conversation-${nextId++}`, ...args.data };
        if (racePending) {
          racePending = false;
          state.raceConversations.push(conversation);
          throw { code: "P2002" };
        }
        state.conversations.push(conversation);
        return conversation;
      },
    },
    kennelConversationParticipant: {
      async createMany(args: { data: Array<{ conversationId: string; kennelId: string }> }) {
        for (const row of args.data) {
          if (!state.participants.some((participant) => participant.conversationId === row.conversationId && participant.kennelId === row.kennelId)) {
            state.participants.push({ ...row, hiddenAt: null });
          }
        }
        return { count: args.data.length };
      },
      async updateMany(args: { where: { conversationId: string; kennelId: { in: string[] } }; data: { hiddenAt: null } }) {
        const matching = state.participants.filter((participant) =>
          participant.conversationId === args.where.conversationId && args.where.kennelId.in.includes(participant.kennelId)
        );
        matching.forEach((participant) => { participant.hiddenAt = args.data.hiddenAt; });
        return { count: matching.length };
      },
      async findUnique(args: { where: { conversationId_kennelId: { conversationId: string; kennelId: string } } }) {
        const key = args.where.conversationId_kennelId;
        return state.participants.find((participant) => participant.conversationId === key.conversationId && participant.kennelId === key.kennelId) ?? null;
      },
    },
    kennelConversationMessage: {
      async create(args: { data: { conversationId: string; senderKennelId: string; body: string } }) {
        const message: FakeMessage = {
          id: `message-${nextId++}`,
          ...args.data,
          createdAt: new Date(nextId * 1000),
        };
        state.messages.push(message);
        return {
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          senderKennel: state.kennels.find((kennel) => kennel.id === message.senderKennelId)!,
        };
      },
    },
    async $transaction<T>(callback: (tx: never) => Promise<T>) {
      return callback(client as never);
    },
  };

  return { client, state };
}

async function expectMessagingError(callback: () => Promise<unknown>, code: KennelMessagingError["code"]) {
  await assert.rejects(callback, (error: unknown) => {
    assert.ok(error instanceof KennelMessagingError);
    assert.equal(error.code, code);
    return true;
  });
}

async function main() {
  const activeA: FakeKennel = { id: "kennel-a", name: "Aster", slug: "aster", userId: "user-a", isNpc: false, moderationStatus: "ACTIVE", user: { moderationStatus: "ACTIVE" } };
  const activeB: FakeKennel = { id: "kennel-b", name: "Birch", slug: "birch", userId: "user-b", isNpc: false, moderationStatus: "ACTIVE", user: { moderationStatus: "ACTIVE" } };
  const activeC: FakeKennel = { id: "kennel-c", name: "Cedar", slug: "cedar", userId: "user-c", isNpc: false, moderationStatus: "ACTIVE", user: { moderationStatus: "ACTIVE" } };
  const fake = createFakeClient({ kennels: [activeA, activeB, activeC] });

  assert.deepEqual(canonicalizeKennelPair("kennel-a", "kennel-b"), canonicalizeKennelPair("kennel-b", "kennel-a"));
  await expectMessagingError(() => Promise.resolve().then(() => canonicalizeKennelPair("kennel-a", "kennel-a")), "SELF_CONVERSATION");
  assert.equal(await findKennelConversation({ requestingKennelId: "kennel-a", otherKennelId: "kennel-b", client: fake.client as never }), null);

  const first = await sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "  Hello\nthere  ", client: fake.client as never });
  assert.equal(first.message.body, "Hello\nthere", "surrounding whitespace is trimmed while line breaks remain");
  assert.equal(fake.state.conversations.length, 1, "first send creates one conversation");
  assert.equal(fake.state.participants.length, 2, "first send creates both participant rows");
  assert.ok(first.message.createdAt instanceof Date, "message uses a real-world Date timestamp");

  const second = await sendKennelMessage({ senderKennelId: "kennel-b", recipientKennelId: "kennel-a", body: "Thanks 🐕", client: fake.client as never });
  assert.equal(second.id, first.id, "reverse-direction sends reuse the canonical conversation");
  assert.equal(fake.state.conversations.length, 1, "later sends do not create a duplicate conversation");

  fake.state.participants.forEach((participant) => { participant.hiddenAt = new Date(); });
  await sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "Restored", client: fake.client as never });
  assert.ok(fake.state.participants.every((participant) => participant.hiddenAt === null), "new activity restores visibility for both participants");

  const historyA = await loadKennelConversationHistory({ requestingKennelId: "kennel-a", conversationId: first.id, client: fake.client as never });
  const historyB = await loadKennelConversationHistory({ requestingKennelId: "kennel-b", conversationId: first.id, client: fake.client as never });
  assert.equal(historyA.messages.length, 3, "history retains prior messages after restoration");
  assert.deepEqual(historyA.messages.map((message) => message.body), ["Hello\nthere", "Thanks 🐕", "Restored"], "history is chronological");
  assert.equal(historyB.messages[1]?.senderKennel.id, "kennel-b", "history includes sender identity");
  await expectMessagingError(() => loadKennelConversationHistory({ requestingKennelId: "kennel-c", conversationId: first.id, client: fake.client as never }), "NOT_CONVERSATION_PARTICIPANT");

  await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "   ", client: fake.client as never }), "INVALID_MESSAGE");
  await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: 42, client: fake.client as never }), "INVALID_MESSAGE");
  await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "x".repeat(MAX_KENNEL_MESSAGE_LENGTH + 1), client: fake.client as never }), "MESSAGE_TOO_LONG");
  await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-a", body: "No", client: fake.client as never }), "SELF_CONVERSATION");

  for (const ineligible of [
    { ...activeB, id: "npc", isNpc: true },
    { ...activeB, id: "system", userId: null, user: null },
    { ...activeB, id: "closed", moderationStatus: "CLOSED" as const },
    { ...activeB, id: "banned", user: { moderationStatus: "BANNED" as const } },
  ]) {
    const eligibilityFake = createFakeClient({ kennels: [activeA, ineligible] });
    await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: ineligible.id, body: "Hello", client: eligibilityFake.client as never }), "KENNEL_NOT_MESSAGEABLE");
  }
  await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "missing", body: "Hello", client: fake.client as never }), "KENNEL_NOT_MESSAGEABLE");

  const raceFake = createFakeClient({ kennels: [activeA, activeB], raceOnFirstCreate: true });
  const recovered = await getOrCreateKennelConversation({ requestingKennelId: "kennel-b", otherKennelId: "kennel-a", client: raceFake.client as never });
  assert.equal(recovered.firstKennel.id, "kennel-a", "unique-race recovery loads the canonical conversation");
  assert.equal(raceFake.state.raceConversations.length, 1, "unique-race recovery leaves one conversation");
  assert.equal(raceFake.state.participants.length, 2, "unique-race recovery ensures exactly two participants");

  const serviceSource = source("apps/web/server/services/kennelMessaging.service.ts");
  assert.ok(serviceSource.includes('moderationStatus: "ACTIVE"'), "service applies active moderation eligibility");
  assert.ok(!serviceSource.includes("kennelBlock"), "service does not implement blocking");
  assert.ok(!serviceSource.includes("kennelCommunicationReport"), "service does not implement reporting");
  assert.ok(!serviceSource.includes("createdAtEpoch"), "service does not introduce game-epoch message timestamps");

  console.log("Kennel messaging checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
