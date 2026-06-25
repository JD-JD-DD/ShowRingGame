export type DogProfileBadgeDto = {
  code: string;
  label: string;
  tone: "neutral" | "purple" | "green" | "yellow" | "red" | "blue";
  href?: string;
};

export type DogProfileKennelDisplayDto = {
  kennelId: string;
  name: string;
  slug: string;
};

export type DogProfileDogLinkDto = {
  dogId: string;
  displayName: string;
  profileUrl: string;
};

export type DogProfileHeaderDto = {
  dogId: string;
  displayName: string;
  registeredName: string | null;
  callName: string | null;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  breedName: string;
  regNumber: string;
  sex: "M" | "F";
  sexLabel: string;
  ageHours: number;
  ageLabel: string;
  lifecycleState: string;
  lifecycleLabel: string;
  originLabel: string;
  badges: DogProfileBadgeDto[];
};

export type DogProfileHealthSummaryDto = {
  completedCount: number;
  totalCount: number;
  label: string;
  badgeStatus: "green" | "yellow" | "red" | null;
  hasFullClearance: boolean;
};

export type DogProfileEmergencyCareDto = {
  eventId: string;
  status: "PENDING";
  createdAtEpoch: number;
  responseDeadlineEpoch: number;
  deadlineLabel: string;
  treatmentCost: number;
  treatmentCostLabel: string;
  survivalChanceBps: number;
  survivalChanceLabel: string;
};

export type DogProfileSnapshotDto = {
  owner: DogProfileKennelDisplayDto | null;
  breeder: DogProfileKennelDisplayDto | null;
  sire: DogProfileDogLinkDto | null;
  dam: DogProfileDogLinkDto | null;
  originLabel: string;
  marketLabel: string;
  canShow: boolean;
  canBreed: boolean;
  showEligibilityLabel: string;
  breedingEligibilityLabel: string;
  groomingLabel: string | null;
  healthTestingSummary: DogProfileHealthSummaryDto;
  coatConditionDisplay: string | null;
};

export type DogProfileVisibleCategoryDto = {
  key: string;
  label: string;
  numericScore: number;
  min: number;
  ideal: number;
  max: number;
  leftLabel: "Under ideal";
  centerLabel: "Ideal";
  rightLabel: "Over ideal";
  scaleMeaning: "Scores below 10 appear under ideal; scores above 10 appear over ideal.";
};

export type DogProfileQualityPresentationDto = {
  visibleCategories: DogProfileVisibleCategoryDto[];
};

export type DogProfilePointWinDto = {
  showDayId: string;
  awardCode: string;
  pointsAwarded: number;
  isMajor: boolean;
};

export type DogProfileShowResultDto = {
  resultId: string;
  showId: string;
  showUrl: string;
  showName: string;
  scheduledEpoch: number;
  showDateLabel: string;
  showDayNumber: number | null;
  districtRegion: string;
  breedCode2: string;
  breedResultUrl: string;
  judgeCode: string;
  judgeName: string;
  judgeProfileUrl: string;
  awardCodes: string[];
  pointsAwarded: number;
  isMajor: boolean;
};

export type DogProfileShowCareerDto = {
  currentTitleCode: string | null;
  isChampionFinished: boolean;
  pointsEarned: number;
  pointsRequired: number;
  majorsEarned: number;
  majorsRequired: number;
  pointsRemaining: number;
  majorsRemaining: number;
  pointRequirementMet: boolean;
  majorRequirementMet: boolean;
  grandPointsEarned: number;
  grandPointsRequired: number;
  grandMajorsEarned: number;
  grandMajorsRequired: number;
  grandChampionDefeatShowCount: number;
  grandChampionDefeatShowRequired: number;
  grandRequirementMet: boolean;
  grandMajorRequirementMet: boolean;
  grandDefeatRequirementMet: boolean;
  isGrandChampionFinished: boolean;
  grandCompletedAtShowDayId: string | null;
  grandCompletedAtEpoch: number | null;
  grandStatusLabel: string;
  grandPointsLabel: string;
  currentGrandTitleLabel: string;
  nextGrandMilestoneLabel: string | null;
  summaryLabel: string;
  recentPointWins: DogProfilePointWinDto[];
  recentShowResults: DogProfileShowResultDto[];
  fullShowRecordUrl: string;
};

export type DogProfileHealthTestDto = {
  testCode: string;
  displayName: string;
  resultLabel: string | null;
  severityKey: "green" | "yellow" | "red" | null;
  healthImpactStatement: string | null;
  testedDateLabel: string | null;
  isComplete: boolean;
  minimumAgeLabel: string;
  isCurrentlyAvailable: boolean;
  cost: number;
};

export type DogProfileAvailableHealthTestDto = {
  testCode: string;
  displayName: string;
  minimumAgeLabel: string;
  cost: number;
};

export type DogProfileHealthOwnerControlsDto = {
  canRunAnyTests: boolean;
  availableTests: DogProfileAvailableHealthTestDto[];
  kennelBalance: number;
  checkoutNeeded: boolean;
  selectedTestSupportData: {
    selectableTestCodes: string[];
    totalAvailableCost: number;
  };
};

export type DogProfileHealthTestingDto = {
  completedCount: number;
  totalCount: number;
  summaryLabel: string;
  tests: DogProfileHealthTestDto[];
  ownerControls: DogProfileHealthOwnerControlsDto | null;
};

export type DogProfileGroomingDetailsDto = {
  weeklyActionsRemaining: number;
  weeklyActionLimit: number;
  currentCoatCondition: number;
  netGroomingEffect: number;
  groomingStatus: string;
  listedForOutsideGrooming: boolean;
  outsideGroomingListingId: string | null;
  totalHistoricalGain: number;
  totalHistoricalDecay: number;
  canGroom: boolean;
  groomedThisWeek: boolean;
  nextGroomingResetEpoch: number | null;
  canOfferOutsideGrooming: boolean;
  canCancelOutsideGrooming: boolean;
};

export type DogProfileActiveBreedingAttemptDto = {
  breedingStatus: string;
  pregCheckEpoch: number | null;
  dueEpoch: number | null;
} | null;

export type DogProfileStudListingDto = {
  isAtStud: true;
  studFee: number;
  listingId: string;
  listingStatusLabel: string;
};

export type DogProfileSaleListingDto = {
  isForSale: true;
  askingPrice: number;
  listingId: string;
  listingStatusLabel: string;
};

export type DogProfileSireHistoryItemDto = {
  attemptId: string;
  usingKennelName: string;
  usingKennelSlug: string | null;
  dateUsedLabel: string;
  damDogId: string;
  damName: string;
  damUrl: string;
  litterId: string | null;
  litterUrl: string | null;
  attemptStatusLabel: string;
};

export type DogProfileDamHistoryItemDto = {
  attemptId: string;
  sireDogId: string;
  sireName: string;
  sireUrl: string;
  litterId: string | null;
  litterUrl: string | null;
  breedingDateLabel: string;
  whelpedDateLabel: string | null;
  puppyCount: number | null;
  survivedCount: number | null;
  attemptStatusLabel: string;
};

export type DogProfileProgenyDto = {
  dogId: string;
  displayName: string;
  dogUrl: string;
  sexLabel: string;
  titleSummary: string | null;
};

export type DogProfileProducerMeritDto = {
  currentMeritLabel: string | null;
  currentMeritSuffix: string | null;
  nextMeritLabel: string | null;
  progressCurrent: number;
  progressRequired: number | null;
  progressLabel: string;
  highestMeritReached: boolean;
};

export type DogProfileBreedingProductionDto = {
  breedingEligibilityLabel: string;
  productionRoleLabel: string;
  activeStudListing: DogProfileStudListingDto | null;
  activeSaleListing: DogProfileSaleListingDto | null;
  sireHistory: DogProfileSireHistoryItemDto[];
  damHistory: DogProfileDamHistoryItemDto[];
  progeny: DogProfileProgenyDto[];
  championOffspringCount: number;
  producerMerit: DogProfileProducerMeritDto;
};

export type DogProfilePedigreeHealthResultDto = {
  testCode: string;
  displayName: string;
  resultLabel: string;
  severityKey: "green" | "yellow" | "red";
};

export type DogProfilePedigreeHealthCountsDto = {
  green: number;
  yellow: number;
  red: number;
};

export type DogProfilePedigreeDogDto = {
  dogId: string;
  displayName: string;
  relationship: string;
  profileUrl: string;
  healthStatusMarkers: {
    badgeStatus: "green" | "yellow" | "red" | null;
    hasFullClearance: boolean;
  };
  colorLabel: "Color: Pending";
  detailedHealthResults: DogProfilePedigreeHealthResultDto[];
  healthSeverityCounts: DogProfilePedigreeHealthCountsDto | null;
};

export type DogProfilePedigreeDto = {
  coiValue: number | null;
  coiLabel: string;
  generationDepth: number | null;
  colorLabel: "Color: Pending";
  healthTestsSummary: string;
  ancestors: DogProfilePedigreeDogDto[];
};

export type DogProfileEntryDto = {
  entryId: string;
  showId: string;
  showUrl: string;
  showName: string;
  showDateLabel: string;
  showDayNumber: number;
  scheduledEpoch: number;
  district: string;
  breedName: string;
  judgeCode: string | null;
  judgeName: string | null;
  judgeProfileUrl: string | null;
  entryStatusLabel: string;
  canPullEntry: boolean;
  pullEntryActionUrl: string | null;
};

export type DogProfileEntriesDto = {
  currentEntriesCount: number;
  nextEntries: DogProfileEntryDto[];
  allEntries: DogProfileEntryDto[];
};

export type DogProfilePlannerTagDto = {
  tagTypeLabel: string;
  goalLabel: string;
  note: string | null;
  updatedAt: string;
};

export type DogProfilePrivatePlanningDto = {
  notes: string | null;
  programPlannerTags: DogProfilePlannerTagDto[];
  breedingProgramGoal: string | null;
  privatePlannerNote: string | null;
  isWatchlisted: boolean;
  isKeeper: boolean;
  canEditNotes: boolean;
} | null;

export type DogProfileActionsDto = {
  canName: boolean;
  canBreed: boolean;
  canBuyActiveListing: boolean;
  canUseActiveStudListing: boolean;
  canOfferForSale: boolean;
  canEditSaleListing: boolean;
  canCancelSaleListing: boolean;
  canOfferAtStud: boolean;
  canEditStudFee: boolean;
  canCancelStudListing: boolean;
  canRehome: boolean;
  rehomePayout: number | null;
  canPullEntries: boolean;
};

export type DogProfileViewerContextDto = {
  isAuthenticated: boolean;
  viewerKennelId: string | null;
  isOwnedByCurrentKennel: boolean;
  canManage: boolean;
  canViewPrivatePlanning: boolean;
};

export type DogProfileDto = {
  header: DogProfileHeaderDto;
  snapshot: DogProfileSnapshotDto;
  qualityAndPresentation: DogProfileQualityPresentationDto;
  titlesAndShowCareer: DogProfileShowCareerDto;
  healthTesting: DogProfileHealthTestingDto;
  groomingDetails: DogProfileGroomingDetailsDto | null;
  activeBreedingAttempt: DogProfileActiveBreedingAttemptDto;
  breedingAndProduction: DogProfileBreedingProductionDto;
  pedigree: DogProfilePedigreeDto;
  entries: DogProfileEntriesDto | null;
  privatePlanning: DogProfilePrivatePlanningDto;
  emergencyCare: DogProfileEmergencyCareDto | null;
  actions: DogProfileActionsDto;
  viewerContext: DogProfileViewerContextDto;
};

export type DogProfileMapperInput = DogProfileDto;

export function mapDogProfile(input: DogProfileMapperInput): DogProfileDto {
  return {
    header: {
      dogId: input.header.dogId,
      displayName: input.header.displayName,
      registeredName: input.header.registeredName,
      callName: input.header.callName,
      visibleTitlePrefix: input.header.visibleTitlePrefix,
      visibleTitleSuffix: input.header.visibleTitleSuffix,
      breedName: input.header.breedName,
      regNumber: input.header.regNumber,
      sex: input.header.sex,
      sexLabel: input.header.sexLabel,
      ageHours: input.header.ageHours,
      ageLabel: input.header.ageLabel,
      lifecycleState: input.header.lifecycleState,
      lifecycleLabel: input.header.lifecycleLabel,
      originLabel: input.header.originLabel,
      badges: input.header.badges.map((badge) => ({
        code: badge.code,
        label: badge.label,
        tone: badge.tone,
        href: badge.href,
      })),
    },
    snapshot: {
      owner: input.snapshot.owner
        ? {
            kennelId: input.snapshot.owner.kennelId,
            name: input.snapshot.owner.name,
            slug: input.snapshot.owner.slug,
          }
        : null,
      breeder: input.snapshot.breeder
        ? {
            kennelId: input.snapshot.breeder.kennelId,
            name: input.snapshot.breeder.name,
            slug: input.snapshot.breeder.slug,
          }
        : null,
      sire: input.snapshot.sire
        ? {
            dogId: input.snapshot.sire.dogId,
            displayName: input.snapshot.sire.displayName,
            profileUrl: input.snapshot.sire.profileUrl,
          }
        : null,
      dam: input.snapshot.dam
        ? {
            dogId: input.snapshot.dam.dogId,
            displayName: input.snapshot.dam.displayName,
            profileUrl: input.snapshot.dam.profileUrl,
          }
        : null,
      originLabel: input.snapshot.originLabel,
      marketLabel: input.snapshot.marketLabel,
      canShow: input.snapshot.canShow,
      canBreed: input.snapshot.canBreed,
      showEligibilityLabel: input.snapshot.showEligibilityLabel,
      breedingEligibilityLabel: input.snapshot.breedingEligibilityLabel,
      groomingLabel: input.snapshot.groomingLabel,
      healthTestingSummary: mapHealthSummary(input.snapshot.healthTestingSummary),
      coatConditionDisplay: input.snapshot.coatConditionDisplay,
    },
    qualityAndPresentation: {
      visibleCategories: input.qualityAndPresentation.visibleCategories.map(
        (category) => ({
          key: category.key,
          label: category.label,
          numericScore: category.numericScore,
          min: category.min,
          ideal: category.ideal,
          max: category.max,
          leftLabel: category.leftLabel,
          centerLabel: category.centerLabel,
          rightLabel: category.rightLabel,
          scaleMeaning: category.scaleMeaning,
        })
      ),
    },
    titlesAndShowCareer: {
      currentTitleCode: input.titlesAndShowCareer.currentTitleCode,
      isChampionFinished: input.titlesAndShowCareer.isChampionFinished,
      pointsEarned: input.titlesAndShowCareer.pointsEarned,
      pointsRequired: input.titlesAndShowCareer.pointsRequired,
      majorsEarned: input.titlesAndShowCareer.majorsEarned,
      majorsRequired: input.titlesAndShowCareer.majorsRequired,
      pointsRemaining: input.titlesAndShowCareer.pointsRemaining,
      majorsRemaining: input.titlesAndShowCareer.majorsRemaining,
      pointRequirementMet: input.titlesAndShowCareer.pointRequirementMet,
      majorRequirementMet: input.titlesAndShowCareer.majorRequirementMet,
      grandPointsEarned: input.titlesAndShowCareer.grandPointsEarned,
      grandPointsRequired: input.titlesAndShowCareer.grandPointsRequired,
      grandMajorsEarned: input.titlesAndShowCareer.grandMajorsEarned,
      grandMajorsRequired: input.titlesAndShowCareer.grandMajorsRequired,
      grandChampionDefeatShowCount:
        input.titlesAndShowCareer.grandChampionDefeatShowCount,
      grandChampionDefeatShowRequired:
        input.titlesAndShowCareer.grandChampionDefeatShowRequired,
      grandRequirementMet: input.titlesAndShowCareer.grandRequirementMet,
      grandMajorRequirementMet:
        input.titlesAndShowCareer.grandMajorRequirementMet,
      grandDefeatRequirementMet:
        input.titlesAndShowCareer.grandDefeatRequirementMet,
      isGrandChampionFinished:
        input.titlesAndShowCareer.isGrandChampionFinished,
      grandCompletedAtShowDayId:
        input.titlesAndShowCareer.grandCompletedAtShowDayId,
      grandCompletedAtEpoch:
        input.titlesAndShowCareer.grandCompletedAtEpoch,
      grandStatusLabel: input.titlesAndShowCareer.grandStatusLabel,
      grandPointsLabel: input.titlesAndShowCareer.grandPointsLabel,
      currentGrandTitleLabel:
        input.titlesAndShowCareer.currentGrandTitleLabel,
      nextGrandMilestoneLabel:
        input.titlesAndShowCareer.nextGrandMilestoneLabel,
      summaryLabel: input.titlesAndShowCareer.summaryLabel,
      recentPointWins: input.titlesAndShowCareer.recentPointWins.map((win) => ({
        showDayId: win.showDayId,
        awardCode: win.awardCode,
        pointsAwarded: win.pointsAwarded,
        isMajor: win.isMajor,
      })),
      recentShowResults: input.titlesAndShowCareer.recentShowResults.map(
        (result) => mapDogProfileShowResult(result)
      ),
      fullShowRecordUrl: input.titlesAndShowCareer.fullShowRecordUrl,
    },
    healthTesting: {
      completedCount: input.healthTesting.completedCount,
      totalCount: input.healthTesting.totalCount,
      summaryLabel: input.healthTesting.summaryLabel,
      tests: input.healthTesting.tests.map((test) => ({
        testCode: test.testCode,
        displayName: test.displayName,
        resultLabel: test.resultLabel,
        severityKey: test.severityKey,
        healthImpactStatement: test.healthImpactStatement,
        testedDateLabel: test.testedDateLabel,
        isComplete: test.isComplete,
        minimumAgeLabel: test.minimumAgeLabel,
        isCurrentlyAvailable: test.isCurrentlyAvailable,
        cost: test.cost,
      })),
      ownerControls: input.healthTesting.ownerControls
        ? {
            canRunAnyTests: input.healthTesting.ownerControls.canRunAnyTests,
            availableTests: input.healthTesting.ownerControls.availableTests.map(
              (test) => ({
                testCode: test.testCode,
                displayName: test.displayName,
                minimumAgeLabel: test.minimumAgeLabel,
                cost: test.cost,
              })
            ),
            kennelBalance: input.healthTesting.ownerControls.kennelBalance,
            checkoutNeeded: input.healthTesting.ownerControls.checkoutNeeded,
            selectedTestSupportData: {
              selectableTestCodes:
                input.healthTesting.ownerControls.selectedTestSupportData.selectableTestCodes.map(
                  (testCode) => testCode
                ),
              totalAvailableCost:
                input.healthTesting.ownerControls.selectedTestSupportData
                  .totalAvailableCost,
            },
          }
        : null,
    },
    groomingDetails: input.groomingDetails
      ? {
          weeklyActionsRemaining: input.groomingDetails.weeklyActionsRemaining,
          weeklyActionLimit: input.groomingDetails.weeklyActionLimit,
          currentCoatCondition: input.groomingDetails.currentCoatCondition,
          netGroomingEffect: input.groomingDetails.netGroomingEffect,
          groomingStatus: input.groomingDetails.groomingStatus,
          listedForOutsideGrooming:
            input.groomingDetails.listedForOutsideGrooming,
          outsideGroomingListingId:
            input.groomingDetails.outsideGroomingListingId,
          totalHistoricalGain: input.groomingDetails.totalHistoricalGain,
          totalHistoricalDecay: input.groomingDetails.totalHistoricalDecay,
          canGroom: input.groomingDetails.canGroom,
          groomedThisWeek: input.groomingDetails.groomedThisWeek,
          nextGroomingResetEpoch:
            input.groomingDetails.nextGroomingResetEpoch,
          canOfferOutsideGrooming:
            input.groomingDetails.canOfferOutsideGrooming,
          canCancelOutsideGrooming:
            input.groomingDetails.canCancelOutsideGrooming,
        }
      : null,
    activeBreedingAttempt: input.activeBreedingAttempt
      ? {
          breedingStatus: input.activeBreedingAttempt.breedingStatus,
          pregCheckEpoch: input.activeBreedingAttempt.pregCheckEpoch,
          dueEpoch: input.activeBreedingAttempt.dueEpoch,
        }
      : null,
    breedingAndProduction: {
      breedingEligibilityLabel:
        input.breedingAndProduction.breedingEligibilityLabel,
      productionRoleLabel: input.breedingAndProduction.productionRoleLabel,
      activeStudListing: input.breedingAndProduction.activeStudListing
        ? {
            isAtStud: true,
            studFee: input.breedingAndProduction.activeStudListing.studFee,
            listingId: input.breedingAndProduction.activeStudListing.listingId,
            listingStatusLabel:
              input.breedingAndProduction.activeStudListing.listingStatusLabel,
          }
        : null,
      activeSaleListing: input.breedingAndProduction.activeSaleListing
        ? {
            isForSale: true,
            askingPrice:
              input.breedingAndProduction.activeSaleListing.askingPrice,
            listingId: input.breedingAndProduction.activeSaleListing.listingId,
            listingStatusLabel:
              input.breedingAndProduction.activeSaleListing.listingStatusLabel,
          }
        : null,
      sireHistory: input.breedingAndProduction.sireHistory.map((item) => ({
        attemptId: item.attemptId,
        usingKennelName: item.usingKennelName,
        usingKennelSlug: item.usingKennelSlug,
        dateUsedLabel: item.dateUsedLabel,
        damDogId: item.damDogId,
        damName: item.damName,
        damUrl: item.damUrl,
        litterId: item.litterId,
        litterUrl: item.litterUrl,
        attemptStatusLabel: item.attemptStatusLabel,
      })),
      damHistory: input.breedingAndProduction.damHistory.map((item) => ({
        attemptId: item.attemptId,
        sireDogId: item.sireDogId,
        sireName: item.sireName,
        sireUrl: item.sireUrl,
        litterId: item.litterId,
        litterUrl: item.litterUrl,
        breedingDateLabel: item.breedingDateLabel,
        whelpedDateLabel: item.whelpedDateLabel,
        puppyCount: item.puppyCount,
        survivedCount: item.survivedCount,
        attemptStatusLabel: item.attemptStatusLabel,
      })),
      progeny: input.breedingAndProduction.progeny.map((offspring) => ({
        dogId: offspring.dogId,
        displayName: offspring.displayName,
        dogUrl: offspring.dogUrl,
        sexLabel: offspring.sexLabel,
        titleSummary: offspring.titleSummary,
      })),
      championOffspringCount:
        input.breedingAndProduction.championOffspringCount,
      producerMerit: {
        currentMeritLabel:
          input.breedingAndProduction.producerMerit.currentMeritLabel,
        currentMeritSuffix:
          input.breedingAndProduction.producerMerit.currentMeritSuffix,
        nextMeritLabel:
          input.breedingAndProduction.producerMerit.nextMeritLabel,
        progressCurrent:
          input.breedingAndProduction.producerMerit.progressCurrent,
        progressRequired:
          input.breedingAndProduction.producerMerit.progressRequired,
        progressLabel:
          input.breedingAndProduction.producerMerit.progressLabel,
        highestMeritReached:
          input.breedingAndProduction.producerMerit.highestMeritReached,
      },
    },
    pedigree: {
      coiValue: input.pedigree.coiValue,
      coiLabel: input.pedigree.coiLabel,
      generationDepth: input.pedigree.generationDepth,
      colorLabel: input.pedigree.colorLabel,
      healthTestsSummary: input.pedigree.healthTestsSummary,
      ancestors: input.pedigree.ancestors.map((dog) => ({
        dogId: dog.dogId,
        displayName: dog.displayName,
        relationship: dog.relationship,
        profileUrl: dog.profileUrl,
        healthStatusMarkers: {
          badgeStatus: dog.healthStatusMarkers.badgeStatus,
          hasFullClearance: dog.healthStatusMarkers.hasFullClearance,
        },
        colorLabel: dog.colorLabel,
        detailedHealthResults: dog.detailedHealthResults.map((result) => ({
          testCode: result.testCode,
          displayName: result.displayName,
          resultLabel: result.resultLabel,
          severityKey: result.severityKey,
        })),
        healthSeverityCounts: dog.healthSeverityCounts
          ? {
              green: dog.healthSeverityCounts.green,
              yellow: dog.healthSeverityCounts.yellow,
              red: dog.healthSeverityCounts.red,
            }
          : null,
      })),
    },
    entries: input.entries
      ? {
          currentEntriesCount: input.entries.currentEntriesCount,
          nextEntries: input.entries.nextEntries.map((entry) =>
            mapDogProfileEntry(entry)
          ),
          allEntries: input.entries.allEntries.map((entry) =>
            mapDogProfileEntry(entry)
          ),
        }
      : null,
    privatePlanning: input.privatePlanning
      ? {
          notes: input.privatePlanning.notes,
          programPlannerTags: input.privatePlanning.programPlannerTags.map(
            (tag) => ({
              tagTypeLabel: tag.tagTypeLabel,
              goalLabel: tag.goalLabel,
              note: tag.note,
              updatedAt: tag.updatedAt,
            })
          ),
          breedingProgramGoal: input.privatePlanning.breedingProgramGoal,
          privatePlannerNote: input.privatePlanning.privatePlannerNote,
          isWatchlisted: input.privatePlanning.isWatchlisted,
          isKeeper: input.privatePlanning.isKeeper,
          canEditNotes: input.privatePlanning.canEditNotes,
        }
      : null,
    emergencyCare: input.emergencyCare
      ? {
          eventId: input.emergencyCare.eventId,
          status: input.emergencyCare.status,
          createdAtEpoch: input.emergencyCare.createdAtEpoch,
          responseDeadlineEpoch: input.emergencyCare.responseDeadlineEpoch,
          deadlineLabel: input.emergencyCare.deadlineLabel,
          treatmentCost: input.emergencyCare.treatmentCost,
          treatmentCostLabel: input.emergencyCare.treatmentCostLabel,
          survivalChanceBps: input.emergencyCare.survivalChanceBps,
          survivalChanceLabel: input.emergencyCare.survivalChanceLabel,
        }
      : null,
    actions: {
      canName: input.actions.canName,
      canBreed: input.actions.canBreed,
      canBuyActiveListing: input.actions.canBuyActiveListing,
      canUseActiveStudListing: input.actions.canUseActiveStudListing,
      canOfferForSale: input.actions.canOfferForSale,
      canEditSaleListing: input.actions.canEditSaleListing,
      canCancelSaleListing: input.actions.canCancelSaleListing,
      canOfferAtStud: input.actions.canOfferAtStud,
      canEditStudFee: input.actions.canEditStudFee,
      canCancelStudListing: input.actions.canCancelStudListing,
      canRehome: input.actions.canRehome,
      rehomePayout: input.actions.rehomePayout,
      canPullEntries: input.actions.canPullEntries,
    },
    viewerContext: {
      isAuthenticated: input.viewerContext.isAuthenticated,
      viewerKennelId: input.viewerContext.viewerKennelId,
      isOwnedByCurrentKennel: input.viewerContext.isOwnedByCurrentKennel,
      canManage: input.viewerContext.canManage,
      canViewPrivatePlanning: input.viewerContext.canViewPrivatePlanning,
    },
  };
}

export function mapDogProfileShowResult(
  result: DogProfileShowResultDto
): DogProfileShowResultDto {
  return {
    resultId: result.resultId,
    showId: result.showId,
    showUrl: result.showUrl,
    showName: result.showName,
    scheduledEpoch: result.scheduledEpoch,
    showDateLabel: result.showDateLabel,
    showDayNumber: result.showDayNumber,
    districtRegion: result.districtRegion,
    breedCode2: result.breedCode2,
    breedResultUrl: result.breedResultUrl,
    judgeCode: result.judgeCode,
    judgeName: result.judgeName,
    judgeProfileUrl: result.judgeProfileUrl,
    awardCodes: result.awardCodes.map((awardCode) => awardCode),
    pointsAwarded: result.pointsAwarded,
    isMajor: result.isMajor,
  };
}

function mapHealthSummary(
  summary: DogProfileHealthSummaryDto
): DogProfileHealthSummaryDto {
  return {
    completedCount: summary.completedCount,
    totalCount: summary.totalCount,
    label: summary.label,
    badgeStatus: summary.badgeStatus,
    hasFullClearance: summary.hasFullClearance,
  };
}

function mapDogProfileEntry(entry: DogProfileEntryDto): DogProfileEntryDto {
  return {
    entryId: entry.entryId,
    showId: entry.showId,
    showUrl: entry.showUrl,
    showName: entry.showName,
    showDateLabel: entry.showDateLabel,
    showDayNumber: entry.showDayNumber,
    scheduledEpoch: entry.scheduledEpoch,
    district: entry.district,
    breedName: entry.breedName,
    judgeCode: entry.judgeCode,
    judgeName: entry.judgeName,
    judgeProfileUrl: entry.judgeProfileUrl,
    entryStatusLabel: entry.entryStatusLabel,
    canPullEntry: entry.canPullEntry,
    pullEntryActionUrl: entry.pullEntryActionUrl,
  };
}
