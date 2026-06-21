DROP TABLE "EmailVerificationToken";

ALTER TABLE "User"
DROP COLUMN "emailVerifiedAt";
