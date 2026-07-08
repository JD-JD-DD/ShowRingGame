-- CreateEnum
CREATE TYPE "UserModerationStatus" AS ENUM ('ACTIVE', 'BANNED');

-- CreateEnum
CREATE TYPE "KennelModerationStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('USER', 'KENNEL', 'IP');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "moderationStatus" "UserModerationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "moderationReason" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "moderatedBy" TEXT;

-- AlterTable
ALTER TABLE "Kennel"
ADD COLUMN "moderationStatus" "KennelModerationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "moderationReason" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "moderatedBy" TEXT;

-- CreateTable
CREATE TABLE "AccessDenylist" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AccessDenylist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAudit" (
    "id" TEXT NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "moderatorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessDenylist_ipAddress_idx" ON "AccessDenylist"("ipAddress");

-- CreateIndex
CREATE INDEX "AccessDenylist_isActive_idx" ON "AccessDenylist"("isActive");

-- Only one currently active denylist row may exist for an IP. Expired rows
-- remain historical until they are explicitly superseded or deactivated.
CREATE UNIQUE INDEX "AccessDenylist_one_active_ip_key"
ON "AccessDenylist"("ipAddress")
WHERE "isActive" = true;

-- CreateIndex
CREATE INDEX "ModerationAudit_targetType_targetId_idx" ON "ModerationAudit"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationAudit_createdAt_idx" ON "ModerationAudit"("createdAt");
