ALTER TABLE "SupportSubscriptionChange"
ADD COLUMN IF NOT EXISTS "expectedEffectiveAt" TIMESTAMP(3);

ALTER TABLE "SupportSubscription"
ADD COLUMN IF NOT EXISTS "paymentFailureStartedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastPaymentFailureAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "lastPaymentRecoveryAt" TIMESTAMP(3);
