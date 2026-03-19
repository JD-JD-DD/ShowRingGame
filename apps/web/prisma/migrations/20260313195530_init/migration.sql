-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "DogLifecycleState" AS ENUM ('ALIVE', 'DECEASED', 'TRANSFERRED', 'RETIRED');

-- CreateEnum
CREATE TYPE "DogMarketState" AS ENUM ('NOT_FOR_SALE', 'LISTED_PLAYER', 'LISTED_NPC', 'SOLD_PENDING_TRANSFER');

-- CreateEnum
CREATE TYPE "DogOriginType" AS ENUM ('FOUNDATION', 'PLAYER_BRED', 'NPC_BRED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "BreedingAttemptStatus" AS ENUM ('INITIATED', 'CHECKED_NOT_PREGNANT', 'PREGNANT', 'WHELPED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShowClusterStatus" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShowDayStatus" AS ENUM ('SCHEDULED', 'ENTRY_OPEN', 'ENTRY_LOCKED', 'JUDGING', 'RESULTS_PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShowEntryStatus" AS ENUM ('ENTERED', 'WITHDRAWN', 'INELIGIBLE', 'ABSENT', 'JUDGED');

-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('PLAYER', 'NPC', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DogListingStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('STARTER_FUNDS', 'SHOW_ENTRY_FEE', 'TRAVEL_COST', 'HANDLER_FEE', 'DOG_PURCHASE', 'DOG_SALE', 'STUD_FEE_IN', 'STUD_FEE_OUT', 'LISTING_FEE', 'UPKEEP', 'PRIZE_WINNINGS', 'REFUND');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kennel" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isNpc" BOOLEAN NOT NULL DEFAULT false,
    "homeDistrict" INTEGER,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "publicSlogan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kennel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Breed" (
    "code2" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Breed_pkey" PRIMARY KEY ("code2")
);

-- CreateTable
CREATE TABLE "Dog" (
    "id" TEXT NOT NULL,
    "regNumber" TEXT NOT NULL,
    "callName" TEXT,
    "registeredName" TEXT,
    "breedCode2" TEXT NOT NULL,
    "ownerKennelId" TEXT,
    "breederKennelId" TEXT,
    "sireId" TEXT,
    "damId" TEXT,
    "litterId" TEXT,
    "litterOrder" INTEGER,
    "sex" "Sex" NOT NULL,
    "birthEpoch" INTEGER NOT NULL,
    "deathEpoch" INTEGER,
    "lifecycleState" "DogLifecycleState" NOT NULL DEFAULT 'ALIVE',
    "marketState" "DogMarketState" NOT NULL DEFAULT 'NOT_FOR_SALE',
    "originType" "DogOriginType" NOT NULL,
    "isFoundation" BOOLEAN NOT NULL DEFAULT false,
    "coiPercent" DOUBLE PRECISION,
    "coiGenerationDepth" INTEGER,
    "visibleTitlePrefix" TEXT,
    "visibleTitleSuffix" TEXT,
    "notesPublic" TEXT,
    "traitHead" INTEGER NOT NULL,
    "traitForequarters" INTEGER NOT NULL,
    "traitHindquarters" INTEGER NOT NULL,
    "traitGait" INTEGER NOT NULL,
    "traitCoat" INTEGER NOT NULL,
    "traitSize" INTEGER NOT NULL,
    "traitTemperament" INTEGER NOT NULL,
    "traitShowShine" INTEGER NOT NULL,
    "traitFeet" INTEGER NOT NULL,
    "traitTopline" INTEGER NOT NULL,
    "ringObedience" INTEGER NOT NULL DEFAULT 0,
    "muscleTone" INTEGER NOT NULL DEFAULT 0,
    "coatCondition" INTEGER NOT NULL DEFAULT 0,
    "fatiguePoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Judge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "homeDistrict" INTEGER,
    "weightTypeExpression" DOUBLE PRECISION NOT NULL,
    "weightStructureBalance" DOUBLE PRECISION NOT NULL,
    "weightMovement" DOUBLE PRECISION NOT NULL,
    "weightCoatPresentation" DOUBLE PRECISION NOT NULL,
    "weightTemperamentRingBehavior" DOUBLE PRECISION NOT NULL,
    "weightConditioningHandling" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Judge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreedingAttempt" (
    "id" TEXT NOT NULL,
    "sireId" TEXT NOT NULL,
    "damId" TEXT NOT NULL,
    "breedCode2" TEXT NOT NULL,
    "createdEpoch" INTEGER NOT NULL,
    "pregCheckEpoch" INTEGER,
    "dueEpoch" INTEGER,
    "checkedEpoch" INTEGER,
    "isPregnant" BOOLEAN,
    "whelpedEpoch" INTEGER,
    "status" "BreedingAttemptStatus" NOT NULL DEFAULT 'INITIATED',
    "litterId" TEXT,
    "rngSeed" INTEGER,
    "createdByKennelId" TEXT,
    "studFeeAmount" INTEGER,
    "notes" TEXT,

    CONSTRAINT "BreedingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Litter" (
    "id" TEXT NOT NULL,
    "breedCode2" TEXT NOT NULL,
    "serial7" TEXT NOT NULL,
    "bornEpoch" INTEGER NOT NULL,
    "sireId" TEXT NOT NULL,
    "damId" TEXT NOT NULL,
    "pupCount" INTEGER NOT NULL,
    "bredByKennelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Litter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowCluster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "district" INTEGER NOT NULL,
    "startEpoch" INTEGER NOT NULL,
    "endEpoch" INTEGER NOT NULL,
    "entryOpenEpoch" INTEGER NOT NULL,
    "entryCloseEpoch" INTEGER NOT NULL,
    "status" "ShowClusterStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowDay" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "scheduledEpoch" INTEGER NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "judgeId" TEXT NOT NULL,
    "status" "ShowDayStatus" NOT NULL DEFAULT 'SCHEDULED',
    "publishedAtEpoch" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowEntry" (
    "id" TEXT NOT NULL,
    "showDayId" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "kennelId" TEXT NOT NULL,
    "breedCode2" TEXT NOT NULL,
    "entryStatus" "ShowEntryStatus" NOT NULL DEFAULT 'ENTERED',
    "enteredAtEpoch" INTEGER NOT NULL,
    "feeCharged" INTEGER NOT NULL,
    "handlerUsed" BOOLEAN NOT NULL DEFAULT false,
    "conditioningSnapshot" INTEGER,
    "fatigueSnapshot" INTEGER,

    CONSTRAINT "ShowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowResult" (
    "id" TEXT NOT NULL,
    "showEntryId" TEXT NOT NULL,
    "showDayId" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "breedCode2" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "finalRank" INTEGER,
    "placementCode" TEXT,
    "baseScore" DOUBLE PRECISION NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "dqCode" TEXT,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "uniqueKennelsInCompetition" INTEGER,
    "publishedAtEpoch" INTEGER NOT NULL,
    "scoringVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "kennelId" TEXT NOT NULL,
    "transactionType" "LedgerTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER,
    "occurredAtEpoch" INTEGER NOT NULL,
    "dogId" TEXT,
    "litterId" TEXT,
    "showClusterId" TEXT,
    "showEntryId" TEXT,
    "counterpartyKennelId" TEXT,
    "memo" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DogListing" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "sellerKennelId" TEXT,
    "sellerType" "SellerType" NOT NULL,
    "askingPrice" INTEGER NOT NULL,
    "listingType" TEXT NOT NULL,
    "status" "DogListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "listedAtEpoch" INTEGER NOT NULL,
    "expiresAtEpoch" INTEGER,
    "soldAtEpoch" INTEGER,
    "buyerKennelId" TEXT,
    "descriptionPublic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DogTitleProgress" (
    "dogId" TEXT NOT NULL,
    "championshipPoints" INTEGER NOT NULL DEFAULT 0,
    "majorCount" INTEGER NOT NULL DEFAULT 0,
    "grandPoints" INTEGER NOT NULL DEFAULT 0,
    "winsByTypeJson" JSONB,
    "currentTitleCode" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogTitleProgress_pkey" PRIMARY KEY ("dogId")
);

-- CreateTable
CREATE TABLE "HealthTestRecord" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "testTypeCode" TEXT NOT NULL,
    "resultCode" TEXT NOT NULL,
    "revealedAtEpoch" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "HealthTestRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Kennel_userId_key" ON "Kennel"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Kennel_name_key" ON "Kennel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Kennel_slug_key" ON "Kennel"("slug");

-- CreateIndex
CREATE INDEX "Kennel_userId_idx" ON "Kennel"("userId");

-- CreateIndex
CREATE INDEX "Kennel_homeDistrict_idx" ON "Kennel"("homeDistrict");

-- CreateIndex
CREATE UNIQUE INDEX "Breed_name_key" ON "Breed"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Dog_regNumber_key" ON "Dog"("regNumber");

-- CreateIndex
CREATE INDEX "Dog_breedCode2_idx" ON "Dog"("breedCode2");

-- CreateIndex
CREATE INDEX "Dog_ownerKennelId_idx" ON "Dog"("ownerKennelId");

-- CreateIndex
CREATE INDEX "Dog_breederKennelId_idx" ON "Dog"("breederKennelId");

-- CreateIndex
CREATE INDEX "Dog_sireId_idx" ON "Dog"("sireId");

-- CreateIndex
CREATE INDEX "Dog_damId_idx" ON "Dog"("damId");

-- CreateIndex
CREATE INDEX "Dog_litterId_idx" ON "Dog"("litterId");

-- CreateIndex
CREATE INDEX "Dog_lifecycleState_idx" ON "Dog"("lifecycleState");

-- CreateIndex
CREATE INDEX "Dog_marketState_idx" ON "Dog"("marketState");

-- CreateIndex
CREATE INDEX "Judge_isActive_idx" ON "Judge"("isActive");

-- CreateIndex
CREATE INDEX "Judge_homeDistrict_idx" ON "Judge"("homeDistrict");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingAttempt_litterId_key" ON "BreedingAttempt"("litterId");

-- CreateIndex
CREATE INDEX "BreedingAttempt_sireId_idx" ON "BreedingAttempt"("sireId");

-- CreateIndex
CREATE INDEX "BreedingAttempt_damId_idx" ON "BreedingAttempt"("damId");

-- CreateIndex
CREATE INDEX "BreedingAttempt_breedCode2_idx" ON "BreedingAttempt"("breedCode2");

-- CreateIndex
CREATE INDEX "BreedingAttempt_createdByKennelId_idx" ON "BreedingAttempt"("createdByKennelId");

-- CreateIndex
CREATE INDEX "BreedingAttempt_status_idx" ON "BreedingAttempt"("status");

-- CreateIndex
CREATE INDEX "Litter_sireId_idx" ON "Litter"("sireId");

-- CreateIndex
CREATE INDEX "Litter_damId_idx" ON "Litter"("damId");

-- CreateIndex
CREATE INDEX "Litter_bredByKennelId_idx" ON "Litter"("bredByKennelId");

-- CreateIndex
CREATE UNIQUE INDEX "Litter_breedCode2_serial7_key" ON "Litter"("breedCode2", "serial7");

-- CreateIndex
CREATE INDEX "ShowCluster_district_idx" ON "ShowCluster"("district");

-- CreateIndex
CREATE INDEX "ShowCluster_year_idx" ON "ShowCluster"("year");

-- CreateIndex
CREATE INDEX "ShowCluster_status_idx" ON "ShowCluster"("status");

-- CreateIndex
CREATE INDEX "ShowDay_judgeId_idx" ON "ShowDay"("judgeId");

-- CreateIndex
CREATE INDEX "ShowDay_scheduledEpoch_idx" ON "ShowDay"("scheduledEpoch");

-- CreateIndex
CREATE INDEX "ShowDay_status_idx" ON "ShowDay"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ShowDay_clusterId_dayIndex_key" ON "ShowDay"("clusterId", "dayIndex");

-- CreateIndex
CREATE INDEX "ShowEntry_dogId_idx" ON "ShowEntry"("dogId");

-- CreateIndex
CREATE INDEX "ShowEntry_kennelId_idx" ON "ShowEntry"("kennelId");

-- CreateIndex
CREATE INDEX "ShowEntry_breedCode2_idx" ON "ShowEntry"("breedCode2");

-- CreateIndex
CREATE INDEX "ShowEntry_entryStatus_idx" ON "ShowEntry"("entryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ShowEntry_showDayId_dogId_key" ON "ShowEntry"("showDayId", "dogId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowResult_showEntryId_key" ON "ShowResult"("showEntryId");

-- CreateIndex
CREATE INDEX "ShowResult_showDayId_idx" ON "ShowResult"("showDayId");

-- CreateIndex
CREATE INDEX "ShowResult_dogId_idx" ON "ShowResult"("dogId");

-- CreateIndex
CREATE INDEX "ShowResult_breedCode2_idx" ON "ShowResult"("breedCode2");

-- CreateIndex
CREATE INDEX "ShowResult_judgeId_idx" ON "ShowResult"("judgeId");

-- CreateIndex
CREATE INDEX "ShowResult_pointsAwarded_idx" ON "ShowResult"("pointsAwarded");

-- CreateIndex
CREATE INDEX "LedgerTransaction_kennelId_idx" ON "LedgerTransaction"("kennelId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_dogId_idx" ON "LedgerTransaction"("dogId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_showClusterId_idx" ON "LedgerTransaction"("showClusterId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_showEntryId_idx" ON "LedgerTransaction"("showEntryId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_counterpartyKennelId_idx" ON "LedgerTransaction"("counterpartyKennelId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_occurredAtEpoch_idx" ON "LedgerTransaction"("occurredAtEpoch");

-- CreateIndex
CREATE INDEX "LedgerTransaction_transactionType_idx" ON "LedgerTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "DogListing_dogId_idx" ON "DogListing"("dogId");

-- CreateIndex
CREATE INDEX "DogListing_sellerKennelId_idx" ON "DogListing"("sellerKennelId");

-- CreateIndex
CREATE INDEX "DogListing_buyerKennelId_idx" ON "DogListing"("buyerKennelId");

-- CreateIndex
CREATE INDEX "DogListing_status_idx" ON "DogListing"("status");

-- CreateIndex
CREATE INDEX "DogListing_sellerType_idx" ON "DogListing"("sellerType");

-- CreateIndex
CREATE INDEX "HealthTestRecord_testTypeCode_idx" ON "HealthTestRecord"("testTypeCode");

-- CreateIndex
CREATE INDEX "HealthTestRecord_resultCode_idx" ON "HealthTestRecord"("resultCode");

-- CreateIndex
CREATE UNIQUE INDEX "HealthTestRecord_dogId_testTypeCode_key" ON "HealthTestRecord"("dogId", "testTypeCode");

-- AddForeignKey
ALTER TABLE "Kennel" ADD CONSTRAINT "Kennel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_ownerKennelId_fkey" FOREIGN KEY ("ownerKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_breederKennelId_fkey" FOREIGN KEY ("breederKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dog" ADD CONSTRAINT "Dog_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_createdByKennelId_fkey" FOREIGN KEY ("createdByKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingAttempt" ADD CONSTRAINT "BreedingAttempt_litterId_fkey" FOREIGN KEY ("litterId") REFERENCES "Litter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Litter" ADD CONSTRAINT "Litter_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Litter" ADD CONSTRAINT "Litter_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Litter" ADD CONSTRAINT "Litter_damId_fkey" FOREIGN KEY ("damId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Litter" ADD CONSTRAINT "Litter_bredByKennelId_fkey" FOREIGN KEY ("bredByKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowDay" ADD CONSTRAINT "ShowDay_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "ShowCluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowDay" ADD CONSTRAINT "ShowDay_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowEntry" ADD CONSTRAINT "ShowEntry_showDayId_fkey" FOREIGN KEY ("showDayId") REFERENCES "ShowDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowEntry" ADD CONSTRAINT "ShowEntry_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowEntry" ADD CONSTRAINT "ShowEntry_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowEntry" ADD CONSTRAINT "ShowEntry_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowResult" ADD CONSTRAINT "ShowResult_showEntryId_fkey" FOREIGN KEY ("showEntryId") REFERENCES "ShowEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowResult" ADD CONSTRAINT "ShowResult_showDayId_fkey" FOREIGN KEY ("showDayId") REFERENCES "ShowDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowResult" ADD CONSTRAINT "ShowResult_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowResult" ADD CONSTRAINT "ShowResult_breedCode2_fkey" FOREIGN KEY ("breedCode2") REFERENCES "Breed"("code2") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowResult" ADD CONSTRAINT "ShowResult_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Judge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_showClusterId_fkey" FOREIGN KEY ("showClusterId") REFERENCES "ShowCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_showEntryId_fkey" FOREIGN KEY ("showEntryId") REFERENCES "ShowEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_counterpartyKennelId_fkey" FOREIGN KEY ("counterpartyKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogListing" ADD CONSTRAINT "DogListing_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogListing" ADD CONSTRAINT "DogListing_sellerKennelId_fkey" FOREIGN KEY ("sellerKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogListing" ADD CONSTRAINT "DogListing_buyerKennelId_fkey" FOREIGN KEY ("buyerKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogTitleProgress" ADD CONSTRAINT "DogTitleProgress_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthTestRecord" ADD CONSTRAINT "HealthTestRecord_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
