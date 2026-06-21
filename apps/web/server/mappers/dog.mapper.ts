export type DogProfileBadgeDto = {
  code: string;
  label: string;
  tone: "neutral" | "purple" | "green" | "yellow" | "red" | "blue";
};

export type DogProfileKennelDisplayDto = {
  kennelId: string;
  name: string;
  slug: string;
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
  sexLabel: string;
  ageHours: number;
  ageLabel: string;
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

export type DogProfileSnapshotDto = {
  owner: DogProfileKennelDisplayDto | null;
  breeder: DogProfileKennelDisplayDto | null;
  originLabel: string;
  marketLabel: string;
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
  summaryLabel: string;
  recentPointWins: DogProfilePointWinDto[];
  recentShowResults: DogProfileShowResultDto[];
  fullShowRecordUrl: string;
};

export type DogProfileHealthTestDto = {
  testTypeCode: string;
  label: string;
  resultLabel: string | null;
  severity: "green" | "yellow" | "red" | null;
  testedAtEpoch: number | null;
  isComplete: boolean;
  isAvailable: boolean;
  availabilityLabel: string;
  fee: number;
};

export type DogProfileHealthTestingDto = {
  summary: DogProfileHealthSummaryDto;
  tests: DogProfileHealthTestDto[];
};

export type DogProfileBreedingProductionDto = {
  championOffspringCount: number;
  producerMeritLabel: string | null;
  producerMeritSuffix: string | null;
  producerMeritLevel: string;
  nextMeritLabel: string | null;
  nextMeritThreshold: number | null;
  progenyCount: number;
};

export type DogProfilePedigreeDogDto = {
  dogId: string;
  displayName: string;
  regNumber: string;
  sex: "M" | "F";
};

export type DogProfilePedigreeDto = {
  coiPercent: number | null;
  generationDepth: number | null;
  sire: DogProfilePedigreeDogDto | null;
  dam: DogProfilePedigreeDogDto | null;
  ancestors: DogProfilePedigreeDogDto[];
};

export type DogProfileEntryDto = {
  entryId: string;
  entryStatus: string;
  showId: string;
  showName: string;
  showDayIndex: number;
  scheduledEpoch: number;
  breedName: string;
  judgeCode: string | null;
  judgeName: string | null;
  canPull: boolean;
};

export type DogProfileEntriesDto = {
  isOwnerOnly: true;
  upcoming: DogProfileEntryDto[];
};

export type DogProfilePlannerTagDto = {
  tagType: string;
  goalKey: string;
  note: string | null;
  updatedAt: string;
};

export type DogProfilePrivatePlanningDto = {
  notes: string | null;
  plannerTags: DogProfilePlannerTagDto[];
} | null;

export type DogProfileActionsDto = {
  canBreed: boolean;
  canGroom: boolean;
  canOfferForSale: boolean;
  canEditSaleListing: boolean;
  canCancelSaleListing: boolean;
  canOfferAtStud: boolean;
  canEditStudFee: boolean;
  canCancelStudListing: boolean;
  canRehome: boolean;
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
  breedingAndProduction: DogProfileBreedingProductionDto;
  pedigree: DogProfilePedigreeDto;
  entries: DogProfileEntriesDto;
  privatePlanning: DogProfilePrivatePlanningDto;
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
      sexLabel: input.header.sexLabel,
      ageHours: input.header.ageHours,
      ageLabel: input.header.ageLabel,
      lifecycleLabel: input.header.lifecycleLabel,
      originLabel: input.header.originLabel,
      badges: input.header.badges.map((badge) => ({
        code: badge.code,
        label: badge.label,
        tone: badge.tone,
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
      originLabel: input.snapshot.originLabel,
      marketLabel: input.snapshot.marketLabel,
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
      summary: mapHealthSummary(input.healthTesting.summary),
      tests: input.healthTesting.tests.map((test) => ({
        testTypeCode: test.testTypeCode,
        label: test.label,
        resultLabel: test.resultLabel,
        severity: test.severity,
        testedAtEpoch: test.testedAtEpoch,
        isComplete: test.isComplete,
        isAvailable: test.isAvailable,
        availabilityLabel: test.availabilityLabel,
        fee: test.fee,
      })),
    },
    breedingAndProduction: {
      championOffspringCount:
        input.breedingAndProduction.championOffspringCount,
      producerMeritLabel: input.breedingAndProduction.producerMeritLabel,
      producerMeritSuffix: input.breedingAndProduction.producerMeritSuffix,
      producerMeritLevel: input.breedingAndProduction.producerMeritLevel,
      nextMeritLabel: input.breedingAndProduction.nextMeritLabel,
      nextMeritThreshold: input.breedingAndProduction.nextMeritThreshold,
      progenyCount: input.breedingAndProduction.progenyCount,
    },
    pedigree: {
      coiPercent: input.pedigree.coiPercent,
      generationDepth: input.pedigree.generationDepth,
      sire: mapPedigreeDog(input.pedigree.sire),
      dam: mapPedigreeDog(input.pedigree.dam),
      ancestors: input.pedigree.ancestors.map((dog) => ({
        dogId: dog.dogId,
        displayName: dog.displayName,
        regNumber: dog.regNumber,
        sex: dog.sex,
      })),
    },
    entries: {
      isOwnerOnly: true,
      upcoming: input.entries.upcoming.map((entry) => ({
        entryId: entry.entryId,
        entryStatus: entry.entryStatus,
        showId: entry.showId,
        showName: entry.showName,
        showDayIndex: entry.showDayIndex,
        scheduledEpoch: entry.scheduledEpoch,
        breedName: entry.breedName,
        judgeCode: entry.judgeCode,
        judgeName: entry.judgeName,
        canPull: entry.canPull,
      })),
    },
    privatePlanning: input.privatePlanning
      ? {
          notes: input.privatePlanning.notes,
          plannerTags: input.privatePlanning.plannerTags.map((tag) => ({
            tagType: tag.tagType,
            goalKey: tag.goalKey,
            note: tag.note,
            updatedAt: tag.updatedAt,
          })),
        }
      : null,
    actions: {
      canBreed: input.actions.canBreed,
      canGroom: input.actions.canGroom,
      canOfferForSale: input.actions.canOfferForSale,
      canEditSaleListing: input.actions.canEditSaleListing,
      canCancelSaleListing: input.actions.canCancelSaleListing,
      canOfferAtStud: input.actions.canOfferAtStud,
      canEditStudFee: input.actions.canEditStudFee,
      canCancelStudListing: input.actions.canCancelStudListing,
      canRehome: input.actions.canRehome,
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

function mapPedigreeDog(
  dog: DogProfilePedigreeDogDto | null
): DogProfilePedigreeDogDto | null {
  return dog
    ? {
        dogId: dog.dogId,
        displayName: dog.displayName,
        regNumber: dog.regNumber,
        sex: dog.sex,
      }
    : null;
}
