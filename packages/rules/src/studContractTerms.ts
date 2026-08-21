/**
 * Persisted Stud Contract vocabulary. These values intentionally match the
 * Prisma enums so client-safe rule consumers do not need a Prisma dependency.
 */
export const STUD_COMPENSATION_TYPES = [
  "CASH",
  "PUPPY_BACK",
  "CASH_AND_PUPPY_BACK",
] as const;
export type StudCompensationType = (typeof STUD_COMPENSATION_TYPES)[number];

export const STUD_PUPPY_PICK_POSITIONS = ["FIRST", "SECOND"] as const;
export type StudPuppyPickPosition =
  (typeof STUD_PUPPY_PICK_POSITIONS)[number];

export const STUD_PUPPY_SEX_REQUIREMENTS = [
  "EITHER",
  "MALE",
  "FEMALE",
] as const;
export type StudPuppySexRequirement =
  (typeof STUD_PUPPY_SEX_REQUIREMENTS)[number];

export const STUD_APPROVAL_MODES = ["AUTOMATIC", "MANUAL"] as const;
export type StudApprovalMode = (typeof STUD_APPROVAL_MODES)[number];

export const STUD_HEALTH_REQUIREMENT_LEVELS = [
  "NONE",
  "GREEN_OR_YELLOW",
  "GREEN_ONLY",
] as const;
export type StudHealthRequirementLevel =
  (typeof STUD_HEALTH_REQUIREMENT_LEVELS)[number];

export const STUD_TITLE_REQUIREMENTS = ["NONE", "CH_OR_HIGHER", "GCH"] as const;
export type StudTitleRequirement = (typeof STUD_TITLE_REQUIREMENTS)[number];

export const STUD_MINIMUM_LITTER_SIZES = [1, 2, 3] as const;
export const STUD_SMALL_LITTER_RETURN_THRESHOLDS = [1, 2, 3] as const;
export const MAX_STUD_CONTRACT_CASH_AMOUNT = 1_000_000;

export type StudOfferHealthRequirementTerms = {
  healthTestCode: string;
  requirementLevel: StudHealthRequirementLevel | null;
};

export type EditableStudOfferTerms = {
  compensationType: StudCompensationType | null;
  cashAmount: number | null;
  puppyPickPosition: StudPuppyPickPosition | null;
  puppySex: StudPuppySexRequirement | null;
  minimumLitterSize: number | null;
  noLitterReturnService: boolean;
  smallLitterReturnThreshold: number | null;
  brucellosisNegativeRequired: boolean;
  titleRequirement: StudTitleRequirement | null;
  approvalMode: StudApprovalMode | null;
  healthRequirements: StudOfferHealthRequirementTerms[];
};

export type StudOfferTermsErrorCode =
  | "INVALID_COMPENSATION_TYPE"
  | "CASH_AMOUNT_REQUIRED"
  | "INVALID_CASH_AMOUNT"
  | "CASH_AMOUNT_TOO_HIGH"
  | "CASH_AMOUNT_NOT_ALLOWED"
  | "PUPPY_PICK_REQUIRED"
  | "PUPPY_PICK_NOT_ALLOWED"
  | "INVALID_PUPPY_PICK"
  | "PUPPY_SEX_REQUIRED"
  | "PUPPY_SEX_NOT_ALLOWED"
  | "INVALID_PUPPY_SEX"
  | "MINIMUM_LITTER_REQUIRED"
  | "MINIMUM_LITTER_NOT_ALLOWED"
  | "INVALID_MINIMUM_LITTER_SIZE"
  | "SECOND_PICK_REQUIRES_MINIMUM_TWO"
  | "INVALID_SMALL_LITTER_RETURN_THRESHOLD"
  | "INVALID_NO_LITTER_RETURN_SERVICE"
  | "INVALID_BRUCELLOSIS_REQUIREMENT"
  | "INVALID_TITLE_REQUIREMENT"
  | "INVALID_APPROVAL_MODE"
  | "HEALTH_TEST_CODE_REQUIRED"
  | "INVALID_HEALTH_REQUIREMENT_LEVEL"
  | "DUPLICATE_HEALTH_TEST_REQUIREMENT";

export type StudOfferTermsValidationError = {
  field: string;
  code: StudOfferTermsErrorCode;
  message: string;
};

export type StudOfferTermsValidationResult = {
  valid: boolean;
  errors: StudOfferTermsValidationError[];
};

export type StudOfferTermsChangedField =
  | "compensationType"
  | "puppyPickPosition";

function includesValue<T>(values: readonly T[], value: unknown): value is T {
  return values.includes(value as T);
}

function addError(
  errors: StudOfferTermsValidationError[],
  field: string,
  code: StudOfferTermsErrorCode,
  message: string
) {
  errors.push({ field, code, message });
}

export function hasPuppyBack(
  compensationType: StudCompensationType | null | undefined
): boolean {
  return (
    compensationType === "PUPPY_BACK" ||
    compensationType === "CASH_AND_PUPPY_BACK"
  );
}

export function requiresCash(
  compensationType: StudCompensationType | null | undefined
): boolean {
  return (
    compensationType === "CASH" ||
    compensationType === "CASH_AND_PUPPY_BACK"
  );
}

export function getAllowedMinimumLitterSizes(
  puppyPickPosition: StudPuppyPickPosition | null | undefined
): readonly number[] {
  if (puppyPickPosition === "FIRST") return STUD_MINIMUM_LITTER_SIZES;
  if (puppyPickPosition === "SECOND") return [2, 3];
  return [];
}

export function isValidSmallLitterReturnThreshold(
  value: unknown
): value is number | null {
  return (
    value === null ||
    includesValue(STUD_SMALL_LITTER_RETURN_THRESHOLDS, value)
  );
}

export function validateStudOfferTerms(
  terms: EditableStudOfferTerms
): StudOfferTermsValidationResult {
  const errors: StudOfferTermsValidationError[] = [];
  const hasValidCompensationType = includesValue(
    STUD_COMPENSATION_TYPES,
    terms.compensationType
  );

  if (!hasValidCompensationType) {
    addError(
      errors,
      "compensationType",
      "INVALID_COMPENSATION_TYPE",
      "Choose a valid compensation type."
    );
  }

  const cashRequired = requiresCash(terms.compensationType);
  const puppyBackRequired = hasPuppyBack(terms.compensationType);

  if (cashRequired && terms.cashAmount === null) {
    addError(errors, "cashAmount", "CASH_AMOUNT_REQUIRED", "Cash compensation requires a whole-dollar amount of at least $1.");
  } else if (terms.cashAmount !== null && (!Number.isSafeInteger(terms.cashAmount) || terms.cashAmount < 1)) {
    addError(errors, "cashAmount", "INVALID_CASH_AMOUNT", "Cash compensation must be a whole-dollar amount of at least $1.");
  } else if (
    terms.cashAmount !== null &&
    terms.cashAmount > MAX_STUD_CONTRACT_CASH_AMOUNT
  ) {
    addError(errors, "cashAmount", "CASH_AMOUNT_TOO_HIGH", "Stud contract cash compensation cannot exceed $1,000,000.");
  } else if (!cashRequired && terms.cashAmount !== null) {
    addError(errors, "cashAmount", "CASH_AMOUNT_NOT_ALLOWED", "Cash compensation is not allowed for Puppy Back terms.");
  }

  if (puppyBackRequired) {
    if (!includesValue(STUD_PUPPY_PICK_POSITIONS, terms.puppyPickPosition)) {
      addError(errors, "puppyPickPosition", terms.puppyPickPosition === null ? "PUPPY_PICK_REQUIRED" : "INVALID_PUPPY_PICK", "Puppy Back compensation requires a valid pick position.");
    }
    if (!includesValue(STUD_PUPPY_SEX_REQUIREMENTS, terms.puppySex)) {
      addError(errors, "puppySex", terms.puppySex === null ? "PUPPY_SEX_REQUIRED" : "INVALID_PUPPY_SEX", "Puppy Back compensation requires a valid puppy sex requirement.");
    }
    if (terms.minimumLitterSize === null) {
      addError(errors, "minimumLitterSize", "MINIMUM_LITTER_REQUIRED", "Puppy Back compensation requires a minimum litter size.");
    } else if (!includesValue(STUD_MINIMUM_LITTER_SIZES, terms.minimumLitterSize)) {
      addError(errors, "minimumLitterSize", "INVALID_MINIMUM_LITTER_SIZE", "Minimum litter size must be 1, 2, or 3.");
    } else if (
      terms.puppyPickPosition === "SECOND" &&
      terms.minimumLitterSize === 1
    ) {
      addError(errors, "minimumLitterSize", "SECOND_PICK_REQUIRES_MINIMUM_TWO", "Second Pick Puppy Back terms require a minimum litter size of 2 or 3.");
    }
  } else {
    if (terms.puppyPickPosition !== null) {
      addError(errors, "puppyPickPosition", "PUPPY_PICK_NOT_ALLOWED", "Puppy pick position is only allowed when Puppy Back compensation is selected.");
    }
    if (terms.puppySex !== null) {
      addError(errors, "puppySex", "PUPPY_SEX_NOT_ALLOWED", "Puppy sex is only allowed when Puppy Back compensation is selected.");
    }
    if (terms.minimumLitterSize !== null) {
      addError(errors, "minimumLitterSize", "MINIMUM_LITTER_NOT_ALLOWED", "Minimum litter size is only allowed when Puppy Back compensation is selected.");
    }
  }

  if (!isValidSmallLitterReturnThreshold(terms.smallLitterReturnThreshold)) {
    addError(errors, "smallLitterReturnThreshold", "INVALID_SMALL_LITTER_RETURN_THRESHOLD", "Small-litter return threshold must be 1, 2, 3, or omitted.");
  }
  if (typeof terms.noLitterReturnService !== "boolean") {
    addError(errors, "noLitterReturnService", "INVALID_NO_LITTER_RETURN_SERVICE", "No-litter return service must be on or off.");
  }
  if (typeof terms.brucellosisNegativeRequired !== "boolean") {
    addError(errors, "brucellosisNegativeRequired", "INVALID_BRUCELLOSIS_REQUIREMENT", "Brucellosis requirement must be on or off.");
  }
  if (!includesValue(STUD_TITLE_REQUIREMENTS, terms.titleRequirement)) {
    addError(errors, "titleRequirement", "INVALID_TITLE_REQUIREMENT", "Choose a valid title requirement.");
  }
  if (!includesValue(STUD_APPROVAL_MODES, terms.approvalMode)) {
    addError(errors, "approvalMode", "INVALID_APPROVAL_MODE", "Choose a valid approval mode.");
  }

  const seenHealthTestCodes = new Set<string>();
  for (const [index, requirement] of terms.healthRequirements.entries()) {
    const field = `healthRequirements.${index}`;
    if (
      !requirement.healthTestCode ||
      requirement.healthTestCode.trim() !== requirement.healthTestCode
    ) {
      addError(errors, `${field}.healthTestCode`, "HEALTH_TEST_CODE_REQUIRED", "Health test code is required.");
    } else if (seenHealthTestCodes.has(requirement.healthTestCode)) {
      addError(errors, `${field}.healthTestCode`, "DUPLICATE_HEALTH_TEST_REQUIREMENT", "Each health test may have only one requirement.");
    } else {
      seenHealthTestCodes.add(requirement.healthTestCode);
    }

    if (!includesValue(STUD_HEALTH_REQUIREMENT_LEVELS, requirement.requirementLevel)) {
      addError(errors, `${field}.requirementLevel`, "INVALID_HEALTH_REQUIREMENT_LEVEL", "Choose a valid health requirement level.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeStudOfferTermsAfterChange(
  previousTerms: EditableStudOfferTerms,
  changedField: "compensationType",
  value: StudCompensationType | null
): EditableStudOfferTerms;
export function normalizeStudOfferTermsAfterChange(
  previousTerms: EditableStudOfferTerms,
  changedField: "puppyPickPosition",
  value: StudPuppyPickPosition | null
): EditableStudOfferTerms;
export function normalizeStudOfferTermsAfterChange(
  previousTerms: EditableStudOfferTerms,
  changedField: StudOfferTermsChangedField,
  value: StudCompensationType | StudPuppyPickPosition | null
): EditableStudOfferTerms {
  const nextTerms: EditableStudOfferTerms = {
    ...previousTerms,
    [changedField]: value,
  } as EditableStudOfferTerms;

  if (changedField === "compensationType") {
    if (value === "CASH") {
      return {
        ...nextTerms,
        puppyPickPosition: null,
        puppySex: null,
        minimumLitterSize: null,
      };
    }

    if (value === "PUPPY_BACK") {
      return { ...nextTerms, cashAmount: null };
    }
  }

  if (
    changedField === "puppyPickPosition" &&
    value === "SECOND" &&
    nextTerms.minimumLitterSize === 1
  ) {
    return { ...nextTerms, minimumLitterSize: null };
  }

  return nextTerms;
}
