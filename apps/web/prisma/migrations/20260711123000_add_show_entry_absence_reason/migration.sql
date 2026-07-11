-- CreateEnum
CREATE TYPE "ShowEntryAbsenceReason" AS ENUM (
    'PREGNANT_AT_SHOW',
    'POST_WHELP_REST_AT_SHOW',
    'DECEASED_BEFORE_SHOW',
    'UNDER_MINIMUM_SHOW_AGE',
    'OVER_MAXIMUM_SHOW_AGE',
    'OWNERSHIP_CHANGED',
    'LIFECYCLE_UNAVAILABLE'
);

-- AlterTable
ALTER TABLE "ShowEntry"
ADD COLUMN "absenceReason" "ShowEntryAbsenceReason";
