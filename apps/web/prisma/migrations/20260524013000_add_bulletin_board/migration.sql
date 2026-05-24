CREATE TYPE "BulletinThreadSource" AS ENUM ('PLAYER', 'SYSTEM');

CREATE TYPE "BulletinThreadStatus" AS ENUM ('OPEN', 'LOCKED', 'HIDDEN');

CREATE TABLE "BulletinCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulletinCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BulletinThread" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "kennelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" "BulletinThreadSource" NOT NULL DEFAULT 'PLAYER',
    "status" "BulletinThreadStatus" NOT NULL DEFAULT 'OPEN',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAtEpoch" INTEGER NOT NULL,
    "lastActivityEpoch" INTEGER NOT NULL,
    "linkedDogId" TEXT,
    "linkedShowId" TEXT,
    "linkedLitterId" TEXT,
    "linkedResultId" TEXT,
    "linkedListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BulletinPost" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "kennelId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceType" "BulletinThreadSource" NOT NULL DEFAULT 'PLAYER',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAtEpoch" INTEGER NOT NULL,
    "editedAtEpoch" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BulletinCategory_slug_key" ON "BulletinCategory"("slug");

CREATE INDEX "BulletinCategory_sortOrder_idx" ON "BulletinCategory"("sortOrder");
CREATE INDEX "BulletinCategory_isActive_idx" ON "BulletinCategory"("isActive");
CREATE INDEX "BulletinThread_categoryId_idx" ON "BulletinThread"("categoryId");
CREATE INDEX "BulletinThread_kennelId_idx" ON "BulletinThread"("kennelId");
CREATE INDEX "BulletinThread_sourceType_idx" ON "BulletinThread"("sourceType");
CREATE INDEX "BulletinThread_status_idx" ON "BulletinThread"("status");
CREATE INDEX "BulletinThread_pinned_idx" ON "BulletinThread"("pinned");
CREATE INDEX "BulletinThread_lastActivityEpoch_idx" ON "BulletinThread"("lastActivityEpoch");
CREATE INDEX "BulletinThread_linkedDogId_idx" ON "BulletinThread"("linkedDogId");
CREATE INDEX "BulletinThread_linkedShowId_idx" ON "BulletinThread"("linkedShowId");
CREATE INDEX "BulletinThread_linkedLitterId_idx" ON "BulletinThread"("linkedLitterId");
CREATE INDEX "BulletinPost_threadId_idx" ON "BulletinPost"("threadId");
CREATE INDEX "BulletinPost_kennelId_idx" ON "BulletinPost"("kennelId");
CREATE INDEX "BulletinPost_sourceType_idx" ON "BulletinPost"("sourceType");
CREATE INDEX "BulletinPost_hidden_idx" ON "BulletinPost"("hidden");
CREATE INDEX "BulletinPost_createdAtEpoch_idx" ON "BulletinPost"("createdAtEpoch");

ALTER TABLE "BulletinThread" ADD CONSTRAINT "BulletinThread_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BulletinCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BulletinThread" ADD CONSTRAINT "BulletinThread_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "BulletinThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BulletinPost" ADD CONSTRAINT "BulletinPost_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "BulletinCategory" ("id", "slug", "name", "description", "sortOrder")
VALUES
    ('general', 'general', 'General', 'General kennel chat and game discussion.', 10),
    ('show-judges-discussion', 'show-judges-discussion', 'Show/Judges Discussion', 'Discuss shows, judging trends, and ring observations.', 20),
    ('brags-wins-new-titles', 'brags-wins-new-titles', 'Brags & Wins/New Titles', 'Share wins, title progress, and proud kennel moments.', 30),
    ('litter-announcements', 'litter-announcements', 'Litter Announcements', 'Announce new litters and puppy availability.', 40),
    ('stud-ads', 'stud-ads', 'Stud Ads', 'Advertise dogs that are actively listed at stud.', 50),
    ('questions-bugs-help', 'questions-bugs-help', 'Questions/Bugs/Help', 'Ask questions, report bugs, and help other players.', 60)
ON CONFLICT ("slug") DO NOTHING;
