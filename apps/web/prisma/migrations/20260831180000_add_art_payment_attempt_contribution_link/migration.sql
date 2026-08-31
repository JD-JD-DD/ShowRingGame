ALTER TABLE "ArtContribution" ADD COLUMN "artPaymentAttemptId" TEXT;
CREATE UNIQUE INDEX "ArtContribution_artPaymentAttemptId_key" ON "ArtContribution"("artPaymentAttemptId");
ALTER TABLE "ArtContribution" ADD CONSTRAINT "ArtContribution_artPaymentAttemptId_fkey" FOREIGN KEY ("artPaymentAttemptId") REFERENCES "ArtPaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
