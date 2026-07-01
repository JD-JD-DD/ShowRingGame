-- Add durable idempotency keys for emergency care events and kennel notices.
ALTER TABLE "DogEmergencyCareEvent"
ADD COLUMN "sourceKey" TEXT;

ALTER TABLE "KennelNotice"
ADD COLUMN "sourceKey" TEXT;

CREATE UNIQUE INDEX "DogEmergencyCareEvent_sourceKey_key"
ON "DogEmergencyCareEvent"("sourceKey");

CREATE UNIQUE INDEX "KennelNotice_sourceKey_key"
ON "KennelNotice"("sourceKey");
