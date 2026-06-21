ALTER TYPE "BulletinThreadStatus" ADD VALUE 'DELETED';

CREATE TYPE "BulletinPostingPolicy" AS ENUM ('MEMBERS', 'ADMINS', 'DISABLED');
CREATE TYPE "BulletinPostStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'DELETED');

ALTER TABLE "User"
ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BulletinCategory"
ADD COLUMN "topicCreationPolicy" "BulletinPostingPolicy" NOT NULL DEFAULT 'MEMBERS',
ADD COLUMN "replyPolicy" "BulletinPostingPolicy" NOT NULL DEFAULT 'MEMBERS',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "BulletinThread"
ADD COLUMN "moderatedByUserId" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "moderationReason" TEXT;

ALTER TABLE "BulletinPost"
ADD COLUMN "moderationStatus" "BulletinPostStatus" NOT NULL DEFAULT 'VISIBLE',
ADD COLUMN "moderatedByUserId" TEXT,
ADD COLUMN "moderatedAt" TIMESTAMP(3),
ADD COLUMN "moderationReason" TEXT;

UPDATE "BulletinPost"
SET "moderationStatus" = 'HIDDEN'
WHERE "hidden" = true;

CREATE INDEX "BulletinThread_moderatedByUserId_idx"
ON "BulletinThread"("moderatedByUserId");

CREATE INDEX "BulletinPost_moderationStatus_idx"
ON "BulletinPost"("moderationStatus");

CREATE INDEX "BulletinPost_moderatedByUserId_idx"
ON "BulletinPost"("moderatedByUserId");
