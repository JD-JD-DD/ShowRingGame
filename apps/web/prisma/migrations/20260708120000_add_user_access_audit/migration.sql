CREATE TABLE "UserAccessAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kennelId" TEXT,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "path" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccessAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserAccessAudit_userId_idx"
ON "UserAccessAudit"("userId");

CREATE INDEX "UserAccessAudit_kennelId_idx"
ON "UserAccessAudit"("kennelId");

CREATE INDEX "UserAccessAudit_ipAddress_idx"
ON "UserAccessAudit"("ipAddress");

CREATE INDEX "UserAccessAudit_createdAt_idx"
ON "UserAccessAudit"("createdAt");
