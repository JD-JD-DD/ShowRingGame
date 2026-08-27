import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  KennelMessagingError,
  MAX_KENNEL_MESSAGE_LENGTH,
  canonicalizeKennelPair,
  blockKennelMessaging,
  findKennelConversation,
  getOrCreateKennelConversation,
  getUnreadKennelConversationCount,
  listKennelConversationSummaries,
  loadKennelConversationHistory,
  markKennelConversationRead,
  sendKennelMessage,
  unblockKennelMessaging,
} from "@/server/services/kennelMessaging.service";
import { formatFriendlyTimestamp } from "@/lib/friendlyTimestamp";

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
  lastReadMessageId: string | null;
};

type FakeMessage = {
  id: string;
  conversationId: string;
  senderKennelId: string;
  body: string;
  createdAt: Date;
};

type FakeBlock = {
  blockerKennelId: string;
  blockedKennelId: string;
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
    blocks: [] as FakeBlock[],
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
            state.participants.push({ ...row, hiddenAt: null, lastReadMessageId: null });
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
      async update(args: { where: { conversationId_kennelId: { conversationId: string; kennelId: string } }; data: { lastReadMessageId: string } }) {
        const key = args.where.conversationId_kennelId;
        const participant = state.participants.find((candidate) =>
          candidate.conversationId === key.conversationId && candidate.kennelId === key.kennelId
        );
        if (!participant) throw new Error("Participant not found.");
        participant.lastReadMessageId = args.data.lastReadMessageId;
        return participant;
      },
      async findUnique(args: { where: { conversationId_kennelId: { conversationId: string; kennelId: string } } }) {
        const key = args.where.conversationId_kennelId;
        return state.participants.find((participant) => participant.conversationId === key.conversationId && participant.kennelId === key.kennelId) ?? null;
      },
      async findMany(args: { where: { kennelId: string; hiddenAt?: null } }) {
        return state.participants
          .filter((participant) =>
            participant.kennelId === args.where.kennelId &&
            (args.where.hiddenAt === undefined || participant.hiddenAt === null)
          )
          .map((participant) => {
            const conversation = findConversation({ id: participant.conversationId })!;
            const messages = state.messages
              .filter((message) => message.conversationId === conversation.id)
              .sort((left, right) =>
                right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id)
              );
            const lastReadMessage = participant.lastReadMessageId
              ? state.messages.find((message) => message.id === participant.lastReadMessageId) ?? null
              : null;
            const kennel = (id: string) => state.kennels.find((candidate) => candidate.id === id)!;
            return {
              conversationId: participant.conversationId,
              lastReadMessageId: participant.lastReadMessageId,
              lastReadMessage,
              conversation: {
                ...conversation,
                firstKennel: kennel(conversation.firstKennelId),
                secondKennel: kennel(conversation.secondKennelId),
                messages: messages.slice(0, 1),
              },
            };
          });
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
      async findFirst(args: { where: { conversationId: string } }) {
        return state.messages
          .filter((message) => message.conversationId === args.where.conversationId)
          .sort((left, right) =>
            right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id)
          )[0] ?? null;
      },
    },
    kennelBlock: {
      async findMany(args: { where: { OR: FakeBlock[] } }) {
        return state.blocks.filter((block) => args.where.OR.some((where) =>
          where.blockerKennelId === block.blockerKennelId && where.blockedKennelId === block.blockedKennelId
        ));
      },
      async upsert(args: { where: { blockerKennelId_blockedKennelId: FakeBlock }; create: FakeBlock }) {
        const pair = args.where.blockerKennelId_blockedKennelId;
        if (!state.blocks.some((block) => block.blockerKennelId === pair.blockerKennelId && block.blockedKennelId === pair.blockedKennelId)) {
          state.blocks.push(args.create);
        }
        return args.create;
      },
      async deleteMany(args: { where: FakeBlock }) {
        const before = state.blocks.length;
        state.blocks = state.blocks.filter((block) =>
          block.blockerKennelId !== args.where.blockerKennelId || block.blockedKennelId !== args.where.blockedKennelId
        );
        return { count: before - state.blocks.length };
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
  assert.equal(
    fake.state.participants.find((participant) => participant.kennelId === "kennel-a")?.lastReadMessageId,
    first.message.id,
    "an inbound message does not advance the recipient read position"
  );
  assert.equal(
    fake.state.participants.find((participant) => participant.kennelId === "kennel-b")?.lastReadMessageId,
    second.message.id,
    "a sender is caught up through its outgoing message"
  );
  assert.equal(
    await getUnreadKennelConversationCount({ kennelId: "kennel-a", client: fake.client as never }),
    1,
    "unread count is one conversation despite a single inbound message"
  );

  const read = await markKennelConversationRead({ requestingKennelId: "kennel-a", conversationId: first.id, client: fake.client as never });
  assert.equal(read.lastReadMessageId, second.message.id, "mark read advances to the latest canonical message");
  assert.equal(
    fake.state.participants.find((participant) => participant.kennelId === "kennel-b")?.lastReadMessageId,
    second.message.id,
    "mark read never changes the other participant"
  );
  const repeatedRead = await markKennelConversationRead({ requestingKennelId: "kennel-a", conversationId: first.id, client: fake.client as never });
  assert.equal(repeatedRead.lastReadMessageId, second.message.id, "mark read is idempotent");
  assert.equal(await getUnreadKennelConversationCount({ kennelId: "kennel-a", client: fake.client as never }), 0, "read conversations are not counted");
  await expectMessagingError(() => markKennelConversationRead({ requestingKennelId: "kennel-c", conversationId: first.id, client: fake.client as never }), "NOT_CONVERSATION_PARTICIPANT");

  fake.state.participants.forEach((participant) => { participant.hiddenAt = new Date(); });
  const restored = await sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "Restored", client: fake.client as never });
  assert.ok(fake.state.participants.every((participant) => participant.hiddenAt === null), "new activity restores visibility for both participants");
  assert.equal(
    fake.state.participants.find((participant) => participant.kennelId === "kennel-a")?.lastReadMessageId,
    restored.message.id,
    "outgoing activity advances only its sender cursor"
  );
  assert.equal(
    fake.state.participants.find((participant) => participant.kennelId === "kennel-b")?.lastReadMessageId,
    second.message.id,
    "outgoing activity does not advance the recipient cursor"
  );

  const summaries = await listKennelConversationSummaries({ kennelId: "kennel-b", client: fake.client as never });
  assert.equal(summaries.length, 1, "a restored conversation returns to the visible inbox");
  assert.equal(summaries[0]?.otherKennel.id, "kennel-a", "summary exposes only the other kennel identity");
  assert.equal(summaries[0]?.latestMessage?.id, restored.message.id, "summary exposes the latest message only");
  assert.equal(summaries[0]?.isUnread, true, "recipient summary is unread after new inbound activity");

  await sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "Still unread", client: fake.client as never });
  assert.equal(await getUnreadKennelConversationCount({ kennelId: "kennel-b", client: fake.client as never }), 1, "multiple inbound messages in one conversation count once");

  const thirdConversation = await sendKennelMessage({ senderKennelId: "kennel-c", recipientKennelId: "kennel-b", body: "Newest", client: fake.client as never });
  const multiSummaries = await listKennelConversationSummaries({ kennelId: "kennel-b", client: fake.client as never });
  assert.equal(multiSummaries.length, 2, "inbox summaries include each visible conversation once");
  assert.equal(multiSummaries[0]?.id, thirdConversation.id, "newest conversation sorts first");
  assert.equal(await getUnreadKennelConversationCount({ kennelId: "kennel-b", client: fake.client as never }), 2, "unread count counts conversations rather than messages");
  const bParticipantInThird = fake.state.participants.find((participant) => participant.conversationId === thirdConversation.id && participant.kennelId === "kennel-b");
  assert.ok(bParticipantInThird, "third-conversation recipient participant exists");
  if (!bParticipantInThird) throw new Error("Expected third-conversation participant.");
  bParticipantInThird.hiddenAt = new Date();
  assert.equal((await listKennelConversationSummaries({ kennelId: "kennel-b", client: fake.client as never })).length, 1, "requester-hidden conversations are excluded");
  assert.equal(await getUnreadKennelConversationCount({ kennelId: "kennel-b", client: fake.client as never }), 1, "requester-hidden conversations do not inflate the unread Inbox count");
  assert.equal((await listKennelConversationSummaries({ kennelId: "kennel-c", client: fake.client as never })).length, 1, "another participant hiding a conversation does not hide it for the requester");

  const historyA = await loadKennelConversationHistory({ requestingKennelId: "kennel-a", conversationId: first.id, client: fake.client as never });
  const historyB = await loadKennelConversationHistory({ requestingKennelId: "kennel-b", conversationId: first.id, client: fake.client as never });
  assert.equal(historyA.messages.length, 4, "history retains prior messages after restoration");
  assert.deepEqual(historyA.messages.map((message) => message.body), ["Hello\nthere", "Thanks 🐕", "Restored", "Still unread"], "history is chronological");
  assert.equal(historyB.messages[1]?.senderKennel.id, "kennel-b", "history includes sender identity");
  await expectMessagingError(() => loadKennelConversationHistory({ requestingKennelId: "kennel-c", conversationId: first.id, client: fake.client as never }), "NOT_CONVERSATION_PARTICIPANT");

  const now = new Date("2026-08-27T12:00:00.000Z");
  const friendly = (elapsedMs: number) => formatFriendlyTimestamp(new Date(now.getTime() - elapsedMs), { now, locale: "en-US" });
  assert.equal(formatFriendlyTimestamp(new Date(now.getTime() + 60_000), { now, locale: "en-US" }), "Just now", "future clock skew is friendly");
  assert.equal(friendly(0), "Just now");
  assert.equal(friendly(59_000), "Just now");
  assert.equal(friendly(60_000), "1 minute ago");
  assert.equal(friendly(2 * 60_000), "2 minutes ago");
  assert.equal(friendly(59 * 60_000 + 59_000), "59 minutes ago");
  assert.equal(friendly(60 * 60_000), "1 hour ago");
  assert.equal(friendly(23 * 60 * 60_000 + 59 * 60_000), "23 hours ago");
  assert.equal(friendly(24 * 60 * 60_000), "1 day ago");
  assert.equal(friendly(6 * 24 * 60 * 60_000 + 23 * 60 * 60_000 + 59 * 60_000), "6 days ago");
  assert.equal(friendly(7 * 24 * 60 * 60_000), "Aug 20", "seven days uses a same-year calendar date");
  assert.equal(formatFriendlyTimestamp(new Date("2025-08-20T12:00:00.000Z"), { now, locale: "en-US" }), "Aug 20, 2025", "prior-year calendar dates include the year");

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

  const blockedFake = createFakeClient({ kennels: [activeA, activeB] });
  const blockedConversation = await sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "History remains", client: blockedFake.client as never });
  const participantsBeforeBlock = JSON.stringify(blockedFake.state.participants);
  await blockKennelMessaging({ blockerKennelId: "kennel-a", blockedKennelId: "kennel-b", client: blockedFake.client as never });
  await blockKennelMessaging({ blockerKennelId: "kennel-a", blockedKennelId: "kennel-b", client: blockedFake.client as never });
  assert.equal(blockedFake.state.blocks.length, 1, "duplicate directional blocks are idempotent");
  assert.equal(blockedFake.state.blocks[0]?.blockerKennelId, "kennel-a", "block retains its initiating kennel");
  await expectMessagingError(() => blockKennelMessaging({ blockerKennelId: "kennel-a", blockedKennelId: "kennel-a", client: blockedFake.client as never }), "SELF_CONVERSATION");
  await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "Blocked by sender", client: blockedFake.client as never }), "MESSAGING_UNAVAILABLE");
  await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-b", recipientKennelId: "kennel-a", body: "Blocked by recipient", client: blockedFake.client as never }), "MESSAGING_UNAVAILABLE");
  assert.equal(blockedFake.state.messages.length, 1, "blocked sends do not create messages");
  assert.equal(blockedFake.state.conversations.length, 1, "blocked sends do not create conversations");
  assert.equal(JSON.stringify(blockedFake.state.participants), participantsBeforeBlock, "blocked sends do not restore hidden state or advance read state");
  assert.equal((await loadKennelConversationHistory({ requestingKennelId: "kennel-b", conversationId: blockedConversation.id, client: blockedFake.client as never })).messages.length, 1, "both participants retain message history after blocking");
  await unblockKennelMessaging({ blockerKennelId: "kennel-a", blockedKennelId: "kennel-b", client: blockedFake.client as never });
  assert.equal(blockedFake.state.blocks.length, 0, "unblock removes only the requester's directional block");
  await sendKennelMessage({ senderKennelId: "kennel-b", recipientKennelId: "kennel-a", body: "Available again", client: blockedFake.client as never });
  await blockKennelMessaging({ blockerKennelId: "kennel-b", blockedKennelId: "kennel-a", client: blockedFake.client as never });
  await unblockKennelMessaging({ blockerKennelId: "kennel-a", blockedKennelId: "kennel-b", client: blockedFake.client as never });
  await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "Other block remains", client: blockedFake.client as never }), "MESSAGING_UNAVAILABLE");

  const blockedNewConversationFake = createFakeClient({ kennels: [activeA, activeB] });
  await blockKennelMessaging({ blockerKennelId: "kennel-b", blockedKennelId: "kennel-a", client: blockedNewConversationFake.client as never });
  await expectMessagingError(() => sendKennelMessage({ senderKennelId: "kennel-a", recipientKennelId: "kennel-b", body: "No first message", client: blockedNewConversationFake.client as never }), "MESSAGING_UNAVAILABLE");
  assert.equal(blockedNewConversationFake.state.conversations.length, 0, "a block prevents first-message conversation creation");
  await blockKennelMessaging({ blockerKennelId: "kennel-a", blockedKennelId: "kennel-b", client: blockedNewConversationFake.client as never });
  assert.equal(blockedNewConversationFake.state.blocks.length, 2, "opposite directional blocks remain distinct");

  const serviceSource = source("apps/web/server/services/kennelMessaging.service.ts");
  assert.ok(serviceSource.includes('moderationStatus: "ACTIVE"'), "service applies active moderation eligibility");
  assert.ok(serviceSource.includes("getKennelMessagingBlockState"), "service centralizes mutual messaging block state");
  assert.ok(serviceSource.includes("assertKennelsCanMessage"), "message mutations use one canonical eligibility and block check");
  assert.ok(serviceSource.includes("This kennel is not currently available for messaging."), "block enforcement has neutral player-facing wording");
  assert.ok(!serviceSource.includes("kennelCommunicationReport"), "service does not implement reporting");
  assert.ok(!serviceSource.includes("createdAtEpoch"), "service does not introduce game-epoch message timestamps");
  assert.ok(serviceSource.includes("lastReadMessageId"), "persisted participant read position is the unread source of truth");
  assert.ok(source("apps/web/lib/friendlyTimestamp.ts").includes("Intl.DateTimeFormat"), "calendar dates use locale-aware Intl formatting");

  console.log("Kennel messaging checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
