ALTER TABLE "Judge" ADD COLUMN "judgeCode" TEXT;

UPDATE "Judge"
SET "judgeCode" = "id"
WHERE "judgeCode" IS NULL;

ALTER TABLE "Judge" ALTER COLUMN "judgeCode" SET NOT NULL;

CREATE UNIQUE INDEX "Judge_judgeCode_key" ON "Judge"("judgeCode");
