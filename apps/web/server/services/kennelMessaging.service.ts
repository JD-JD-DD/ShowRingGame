import { db } from "@/lib/db";

export const MAX_KENNEL_MESSAGE_LENGTH = 4000;

export type KennelMessagingErrorCode =
  | "SELF_CONVERSATION"
  | "INVALID_MESSAGE"
  | "MESSAGE_TOO_LONG"
  | "KENNEL_NOT_MESSAGEABLE"
  | "CONVERSATION_NOT_FOUND"
  | "NOT_CONVERSATION_PARTICIPANT";

export class KennelMessagingError extends Error {
  constructor(readonly code: KennelMessagingErrorCode, message: string) {
    super(message);
    this.name = "KennelMessagingError";
  }
}

export type KennelIdentityDto = {
  id: string;
  name: string;
  slug: string;
};

export type KennelConversationDto = {
  id: string;
  firstKennel: KennelIdentityDto;
  secondKennel: KennelIdentityDto;
};

export type KennelConversationMessageDto = {
  id: string;
  body: string;
  createdAt: Date;
  senderKennel: KennelIdentityDto;
};

export type KennelConversationHistoryDto = KennelConversationDto & {
  messages: KennelConversationMessageDto[];
};

export type KennelConversationSummaryDto = {
  id: string;
  otherKennel: KennelIdentityDto;
  latestMessage: {
    id: string;
    senderKennelId: string;
    body: string;
    createdAt: Date;
  } | null;
  isUnread: boolean;
};

export type KennelConversationReadResult = {
  conversationId: string;
  lastReadMessageId: string | null;
};

type MessageableKennel = KennelIdentityDto & {
  userId: string | null;
  isNpc: boolean;
  moderationStatus: "ACTIVE" | "CLOSED";
  user: { moderationStatus: "ACTIVE" | "BANNED" } | null;
};

type ConversationRecord = {
  id: string;
  firstKennelId: string;
  secondKennelId: string;
};

type MessagingClient = {
  kennel: {
    findMany(args: unknown): Promise<MessageableKennel[]>;
  };
  kennelConversation: {
    findUnique(args: unknown): Promise<ConversationRecord | null>;
    create(args: unknown): Promise<ConversationRecord>;
  };
  kennelConversationParticipant: {
    createMany(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<{
      conversationId: string;
      kennelId: string;
      lastReadMessageId?: string | null;
    } | null>;
    findMany(args: unknown): Promise<unknown[]>;
  };
  kennelConversationMessage: {
    create(args: unknown): Promise<{
      id: string;
      body: string;
      createdAt: Date;
      senderKennel: KennelIdentityDto;
    }>;
    findFirst(args: unknown): Promise<{ id: string; createdAt: Date } | null>;
  };
};

type MessagingRootClient = MessagingClient & {
  $transaction<T>(callback: (tx: MessagingClient) => Promise<T>): Promise<T>;
};

type ConversationWithHistory = {
  id: string;
  firstKennel: KennelIdentityDto;
  secondKennel: KennelIdentityDto;
  messages: Array<{
    id: string;
    body: string;
    createdAt: Date;
    senderKennel: KennelIdentityDto;
  }>;
};

type OrderedMessage = {
  id: string;
  createdAt: Date;
  senderKennelId: string;
  body: string;
};

type ConversationSummaryReadModel = {
  conversationId: string;
  lastReadMessageId: string | null;
  lastReadMessage: Pick<OrderedMessage, "id" | "createdAt"> | null;
  conversation: {
    id: string;
    firstKennelId: string;
    secondKennelId: string;
    firstKennel: KennelIdentityDto;
    secondKennel: KennelIdentityDto;
    messages: OrderedMessage[];
  };
};

export function canonicalizeKennelPair(firstKennelId: string, secondKennelId: string) {
  if (firstKennelId === secondKennelId) {
    throw new KennelMessagingError(
      "SELF_CONVERSATION",
      "A kennel cannot message itself."
    );
  }

  return firstKennelId < secondKennelId
    ? { firstKennelId, secondKennelId }
    : { firstKennelId: secondKennelId, secondKennelId: firstKennelId };
}

export function normalizeKennelMessageBody(body: unknown): string {
  if (typeof body !== "string") {
    throw new KennelMessagingError("INVALID_MESSAGE", "Message content must be text.");
  }

  const normalized = body.trim();
  if (!normalized) {
    throw new KennelMessagingError("INVALID_MESSAGE", "Message content cannot be blank.");
  }

  if (normalized.length > MAX_KENNEL_MESSAGE_LENGTH) {
    throw new KennelMessagingError(
      "MESSAGE_TOO_LONG",
      `Message content cannot exceed ${MAX_KENNEL_MESSAGE_LENGTH} characters.`
    );
  }

  return normalized;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function requireMessageableKennels(args: {
  client: MessagingClient;
  kennelIds: [string, string];
}): Promise<[MessageableKennel, MessageableKennel]> {
  const kennels = await args.client.kennel.findMany({
    where: {
      id: { in: args.kennelIds },
      isNpc: false,
      userId: { not: null },
      moderationStatus: "ACTIVE",
      user: { is: { moderationStatus: "ACTIVE" } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      userId: true,
      isNpc: true,
      moderationStatus: true,
      user: { select: { moderationStatus: true } },
    },
  });

  const byId = new Map(kennels.map((kennel) => [kennel.id, kennel]));
  const firstKennel = byId.get(args.kennelIds[0]);
  const secondKennel = byId.get(args.kennelIds[1]);

  if (!firstKennel || !secondKennel) {
    throw new KennelMessagingError(
      "KENNEL_NOT_MESSAGEABLE",
      "Both kennels must be active player kennels to use messaging."
    );
  }

  return [firstKennel, secondKennel];
}

async function ensureConversationParticipants(args: {
  client: MessagingClient;
  conversationId: string;
  kennelIds: [string, string];
}) {
  await args.client.kennelConversationParticipant.createMany({
    data: args.kennelIds.map((kennelId) => ({
      conversationId: args.conversationId,
      kennelId,
    })),
    skipDuplicates: true,
  });
}

async function resolveConversationForMessaging(args: {
  client: MessagingClient;
  pair: { firstKennelId: string; secondKennelId: string };
  allowCreate: boolean;
}): Promise<ConversationRecord> {
  await requireMessageableKennels({
    client: args.client,
    kennelIds: [args.pair.firstKennelId, args.pair.secondKennelId],
  });

  const existing = await args.client.kennelConversation.findUnique({
    where: {
      firstKennelId_secondKennelId: args.pair,
    },
  });

  if (existing) {
    await ensureConversationParticipants({
      client: args.client,
      conversationId: existing.id,
      kennelIds: [args.pair.firstKennelId, args.pair.secondKennelId],
    });
    return existing;
  }

  if (!args.allowCreate) {
    throw new KennelMessagingError("CONVERSATION_NOT_FOUND", "Conversation not found.");
  }

  const conversation = await args.client.kennelConversation.create({
    data: args.pair,
  });

  await ensureConversationParticipants({
    client: args.client,
    conversationId: conversation.id,
    kennelIds: [args.pair.firstKennelId, args.pair.secondKennelId],
  });

  return conversation;
}

async function runWithConversationRaceRecovery<T>(args: {
  client: MessagingRootClient;
  pair: { firstKennelId: string; secondKennelId: string };
  operation: (tx: MessagingClient, conversation: ConversationRecord) => Promise<T>;
}): Promise<T> {
  try {
    return await args.client.$transaction(async (tx) => {
      const conversation = await resolveConversationForMessaging({
        client: tx,
        pair: args.pair,
        allowCreate: true,
      });
      return args.operation(tx, conversation);
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    return args.client.$transaction(async (tx) => {
      const conversation = await resolveConversationForMessaging({
        client: tx,
        pair: args.pair,
        allowCreate: false,
      });
      return args.operation(tx, conversation);
    });
  }
}

function toConversationDto(args: {
  conversation: ConversationRecord;
  kennels: [MessageableKennel, MessageableKennel];
}): KennelConversationDto {
  const kennelById = new Map(args.kennels.map((kennel) => [kennel.id, kennel]));
  const firstKennel = kennelById.get(args.conversation.firstKennelId);
  const secondKennel = kennelById.get(args.conversation.secondKennelId);

  if (!firstKennel || !secondKennel) {
    throw new KennelMessagingError("KENNEL_NOT_MESSAGEABLE", "A conversation participant is unavailable.");
  }

  return {
    id: args.conversation.id,
    firstKennel: { id: firstKennel.id, name: firstKennel.name, slug: firstKennel.slug },
    secondKennel: { id: secondKennel.id, name: secondKennel.name, slug: secondKennel.slug },
  };
}

export async function findKennelConversation(args: {
  requestingKennelId: string;
  otherKennelId: string;
  client?: MessagingClient;
}): Promise<KennelConversationDto | null> {
  const pair = canonicalizeKennelPair(args.requestingKennelId, args.otherKennelId);
  const client = args.client ?? (db as unknown as MessagingClient);
  const kennels = await requireMessageableKennels({
    client,
    kennelIds: [pair.firstKennelId, pair.secondKennelId],
  });
  const conversation = await client.kennelConversation.findUnique({
    where: { firstKennelId_secondKennelId: pair },
  });

  return conversation ? toConversationDto({ conversation, kennels }) : null;
}

export async function getOrCreateKennelConversation(args: {
  requestingKennelId: string;
  otherKennelId: string;
  client?: MessagingRootClient;
}): Promise<KennelConversationDto> {
  const pair = canonicalizeKennelPair(args.requestingKennelId, args.otherKennelId);
  const client = args.client ?? (db as unknown as MessagingRootClient);
  const conversation = await runWithConversationRaceRecovery({
    client,
    pair,
    operation: async (_tx, resolvedConversation) => resolvedConversation,
  });
  const kennels = await requireMessageableKennels({
    client,
    kennelIds: [pair.firstKennelId, pair.secondKennelId],
  });
  return toConversationDto({ conversation, kennels });
}

export async function sendKennelMessage(args: {
  senderKennelId: string;
  recipientKennelId: string;
  body: unknown;
  client?: MessagingRootClient;
}): Promise<KennelConversationDto & { message: KennelConversationMessageDto }> {
  const pair = canonicalizeKennelPair(args.senderKennelId, args.recipientKennelId);
  const body = normalizeKennelMessageBody(args.body);
  const client = args.client ?? (db as unknown as MessagingRootClient);

  return runWithConversationRaceRecovery({
    client,
    pair,
    operation: async (tx, conversation) => {
      await tx.kennelConversationParticipant.updateMany({
        where: {
          conversationId: conversation.id,
          kennelId: { in: [pair.firstKennelId, pair.secondKennelId] },
        },
        data: { hiddenAt: null },
      });

      const message = await tx.kennelConversationMessage.create({
        data: {
          conversationId: conversation.id,
          senderKennelId: args.senderKennelId,
          body,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderKennel: { select: { id: true, name: true, slug: true } },
        },
      });
      await tx.kennelConversationParticipant.update({
        where: {
          conversationId_kennelId: {
            conversationId: conversation.id,
            kennelId: args.senderKennelId,
          },
        },
        data: {
          lastReadMessageId: message.id,
        },
      });
      const kennels = await requireMessageableKennels({
        client: tx,
        kennelIds: [pair.firstKennelId, pair.secondKennelId],
      });

      return {
        ...toConversationDto({ conversation, kennels }),
        message,
      };
    },
  });
}

export async function loadKennelConversationHistory(args: {
  requestingKennelId: string;
  conversationId: string;
  client?: MessagingClient;
}): Promise<KennelConversationHistoryDto> {
  const client = args.client ?? (db as unknown as MessagingClient);
  const participant = await client.kennelConversationParticipant.findUnique({
    where: {
      conversationId_kennelId: {
        conversationId: args.conversationId,
        kennelId: args.requestingKennelId,
      },
    },
  });

  if (!participant) {
    throw new KennelMessagingError(
      "NOT_CONVERSATION_PARTICIPANT",
      "You are not a participant in this conversation."
    );
  }

  const conversation = (await client.kennelConversation.findUnique({
    where: { id: args.conversationId },
    select: {
      id: true,
      firstKennel: { select: { id: true, name: true, slug: true } },
      secondKennel: { select: { id: true, name: true, slug: true } },
      messages: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          body: true,
          createdAt: true,
          senderKennel: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  })) as ConversationWithHistory | null;

  if (!conversation) {
    throw new KennelMessagingError("CONVERSATION_NOT_FOUND", "Conversation not found.");
  }

  return conversation;
}

function compareMessageOrder(
  left: Pick<OrderedMessage, "id" | "createdAt">,
  right: Pick<OrderedMessage, "id" | "createdAt">
): number {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}

function isConversationUnreadForKennel(args: {
  kennelId: string;
  latestMessage: OrderedMessage | null;
  lastReadMessage: Pick<OrderedMessage, "id" | "createdAt"> | null;
}): boolean {
  if (!args.latestMessage || args.latestMessage.senderKennelId === args.kennelId) {
    return false;
  }

  return !args.lastReadMessage || compareMessageOrder(args.latestMessage, args.lastReadMessage) > 0;
}

async function loadConversationSummaryReadModels(args: {
  client: MessagingClient;
  kennelId: string;
  visibleOnly: boolean;
}): Promise<ConversationSummaryReadModel[]> {
  return (await args.client.kennelConversationParticipant.findMany({
    where: {
      kennelId: args.kennelId,
      ...(args.visibleOnly ? { hiddenAt: null } : {}),
    },
    select: {
      conversationId: true,
      lastReadMessageId: true,
      lastReadMessage: { select: { id: true, createdAt: true } },
      conversation: {
        select: {
          id: true,
          firstKennelId: true,
          secondKennelId: true,
          firstKennel: { select: { id: true, name: true, slug: true } },
          secondKennel: { select: { id: true, name: true, slug: true } },
          messages: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              id: true,
              senderKennelId: true,
              body: true,
              createdAt: true,
            },
          },
        },
      },
    },
  })) as ConversationSummaryReadModel[];
}

export async function markKennelConversationRead(args: {
  requestingKennelId: string;
  conversationId: string;
  client?: MessagingClient;
}): Promise<KennelConversationReadResult> {
  const client = args.client ?? (db as unknown as MessagingClient);
  const participant = await client.kennelConversationParticipant.findUnique({
    where: {
      conversationId_kennelId: {
        conversationId: args.conversationId,
        kennelId: args.requestingKennelId,
      },
    },
  });

  if (!participant) {
    throw new KennelMessagingError(
      "NOT_CONVERSATION_PARTICIPANT",
      "You are not a participant in this conversation."
    );
  }

  const latestMessage = await client.kennelConversationMessage.findFirst({
    where: { conversationId: args.conversationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, createdAt: true },
  });

  if (!latestMessage) {
    return {
      conversationId: args.conversationId,
      lastReadMessageId: participant.lastReadMessageId ?? null,
    };
  }

  await client.kennelConversationParticipant.update({
    where: {
      conversationId_kennelId: {
        conversationId: args.conversationId,
        kennelId: args.requestingKennelId,
      },
    },
    data: { lastReadMessageId: latestMessage.id },
  });

  return {
    conversationId: args.conversationId,
    lastReadMessageId: latestMessage.id,
  };
}

export async function getUnreadKennelConversationCount(args: {
  kennelId: string;
  client?: MessagingClient;
}): Promise<number> {
  const client = args.client ?? (db as unknown as MessagingClient);
  const participants = await loadConversationSummaryReadModels({
    client,
    kennelId: args.kennelId,
    visibleOnly: true,
  });

  return participants.filter((participant) =>
    isConversationUnreadForKennel({
      kennelId: args.kennelId,
      latestMessage: participant.conversation.messages[0] ?? null,
      lastReadMessage: participant.lastReadMessage,
    })
  ).length;
}

export async function listKennelConversationSummaries(args: {
  kennelId: string;
  client?: MessagingClient;
}): Promise<KennelConversationSummaryDto[]> {
  const client = args.client ?? (db as unknown as MessagingClient);
  const participants = await loadConversationSummaryReadModels({
    client,
    kennelId: args.kennelId,
    visibleOnly: true,
  });

  return participants
    .map((participant) => {
      const latestMessage = participant.conversation.messages[0] ?? null;
      const otherKennel = participant.conversation.firstKennelId === args.kennelId
        ? participant.conversation.secondKennel
        : participant.conversation.firstKennel;

      return {
        id: participant.conversation.id,
        otherKennel,
        latestMessage: latestMessage
          ? {
              id: latestMessage.id,
              senderKennelId: latestMessage.senderKennelId,
              body: latestMessage.body,
              createdAt: latestMessage.createdAt,
            }
          : null,
        isUnread: isConversationUnreadForKennel({
          kennelId: args.kennelId,
          latestMessage,
          lastReadMessage: participant.lastReadMessage,
        }),
      };
    })
    .sort((left, right) => {
      const createdAtDifference = (right.latestMessage?.createdAt.getTime() ?? 0) -
        (left.latestMessage?.createdAt.getTime() ?? 0);
      const messageIdDifference = (right.latestMessage?.id ?? "").localeCompare(
        left.latestMessage?.id ?? ""
      );
      return createdAtDifference || messageIdDifference || right.id.localeCompare(left.id);
    });
}
