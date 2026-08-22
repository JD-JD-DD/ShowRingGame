ALTER TABLE "StudContract" DROP COLUMN "qualificationCheckpointAt";
ALTER TABLE "StudContract" DROP COLUMN "qualifyingSurvivingPuppyCount";
ALTER TABLE "StudContract" ADD COLUMN "whelpQualificationAt" TIMESTAMP(3);
ALTER TABLE "StudContract" ADD COLUMN "liveBornPuppyCount" INTEGER;
