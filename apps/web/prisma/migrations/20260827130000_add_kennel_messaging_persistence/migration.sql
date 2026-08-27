-- MESSAGING-01: player correspondence is deliberately separate from the
-- canonical KennelNotice system, which remains the system-notice domain.
CREATE TYPE "KennelCommunicationReportReason" AS ENUM (
  'HARASSMENT',
  'HATE_SPEECH',
  'SPAM',
  'SCAM',
  'THREAT',
  'OTHER'
);

CREATE TYPE "KennelCommunicationReportStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "KennelConversation" (
  "id" TEXT NOT NULL,
  "firstKennelId" TEXT NOT NULL,
  "secondKennelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KennelConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KennelConversation_canonical_pair_check"
    CHECK ("firstKennelId" < "secondKennelId")
);

CREATE TABLE "KennelConversationMessage" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderKennelId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KennelConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KennelConversationParticipant" (
  "conversationId" TEXT NOT NULL,
  "kennelId" TEXT NOT NULL,
  "lastReadMessageId" TEXT,
  "hiddenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KennelConversationParticipant_pkey"
    PRIMARY KEY ("conversationId", "kennelId")
);

CREATE TABLE "KennelBlock" (
  "id" TEXT NOT NULL,
  "blockerKennelId" TEXT NOT NULL,
  "blockedKennelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KennelBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KennelBlock_distinct_kennels_check"
    CHECK ("blockerKennelId" <> "blockedKennelId")
);

CREATE TABLE "KennelCommunicationReport" (
  "id" TEXT NOT NULL,
  "reporterKennelId" TEXT NOT NULL,
  "reportedKennelId" TEXT NOT NULL,
  "messageId" TEXT,
  "conversationId" TEXT,
  "reason" "KennelCommunicationReportReason" NOT NULL,
  "detail" TEXT,
  "status" "KennelCommunicationReportStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),

  CONSTRAINT "KennelCommunicationReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KennelConversation_firstKennelId_secondKennelId_key"
  ON "KennelConversation"("firstKennelId", "secondKennelId");

CREATE INDEX "KennelConversationMessage_conversationId_createdAt_idx"
  ON "KennelConversationMessage"("conversationId", "createdAt");
CREATE INDEX "KennelConversationMessage_senderKennelId_idx"
  ON "KennelConversationMessage"("senderKennelId");

CREATE INDEX "KennelConversationParticipant_kennelId_hiddenAt_idx"
  ON "KennelConversationParticipant"("kennelId", "hiddenAt");
CREATE INDEX "KennelConversationParticipant_lastReadMessageId_idx"
  ON "KennelConversationParticipant"("lastReadMessageId");

CREATE UNIQUE INDEX "KennelBlock_blockerKennelId_blockedKennelId_key"
  ON "KennelBlock"("blockerKennelId", "blockedKennelId");
CREATE INDEX "KennelBlock_blockedKennelId_idx" ON "KennelBlock"("blockedKennelId");

CREATE INDEX "KennelCommunicationReport_status_createdAt_idx"
  ON "KennelCommunicationReport"("status", "createdAt");
CREATE INDEX "KennelCommunicationReport_reporterKennelId_idx"
  ON "KennelCommunicationReport"("reporterKennelId");
CREATE INDEX "KennelCommunicationReport_reportedKennelId_idx"
  ON "KennelCommunicationReport"("reportedKennelId");
CREATE INDEX "KennelCommunicationReport_messageId_idx"
  ON "KennelCommunicationReport"("messageId");
CREATE INDEX "KennelCommunicationReport_conversationId_idx"
  ON "KennelCommunicationReport"("conversationId");

ALTER TABLE "KennelConversation"
  ADD CONSTRAINT "KennelConversation_firstKennelId_fkey"
  FOREIGN KEY ("firstKennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KennelConversation_secondKennelId_fkey"
  FOREIGN KEY ("secondKennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KennelConversationMessage"
  ADD CONSTRAINT "KennelConversationMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "KennelConversation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KennelConversationMessage_senderKennelId_fkey"
  FOREIGN KEY ("senderKennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KennelConversationParticipant"
  ADD CONSTRAINT "KennelConversationParticipant_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "KennelConversation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KennelConversationParticipant_kennelId_fkey"
  FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KennelConversationParticipant_lastReadMessageId_fkey"
  FOREIGN KEY ("lastReadMessageId") REFERENCES "KennelConversationMessage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KennelBlock"
  ADD CONSTRAINT "KennelBlock_blockerKennelId_fkey"
  FOREIGN KEY ("blockerKennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KennelBlock_blockedKennelId_fkey"
  FOREIGN KEY ("blockedKennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KennelCommunicationReport"
  ADD CONSTRAINT "KennelCommunicationReport_reporterKennelId_fkey"
  FOREIGN KEY ("reporterKennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KennelCommunicationReport_reportedKennelId_fkey"
  FOREIGN KEY ("reportedKennelId") REFERENCES "Kennel"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "KennelCommunicationReport_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "KennelConversationMessage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "KennelCommunicationReport_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "KennelConversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
