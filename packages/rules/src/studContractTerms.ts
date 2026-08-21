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
  | "NO_LITTER_RETURN_SERVICE_REQUIRED"
  | "SMALL_LITTER_RETURN_SERVICE_REQUIRED"
  | "INVALID_NO_LITTER_RETURN_SERVICE"
  | "INVALID_BRUCELLOSIS_REQUIREMENT"
  | "BRUCELLOSIS_REQUIREMENT_REQUIRED"
  | "INVALID_TITLE_REQUIREMENT"
  | "TITLE_REQUIREMENT_REQUIRED"
  | "INVALID_APPROVAL_MODE"
  | "APPROVAL_MODE_REQUIRED"
  | "HEALTH_TEST_CODE_REQUIRED"
  | "INVALID_HEALTH_REQUIREMENT_LEVEL"
  | "DUPLICATE_HEALTH_TEST_REQUIREMENT"
  | "HEALTH_REQUIREMENT_REQUIRED"
  | "UNEXPECTED_HEALTH_TEST_REQUIREMENT";

export type StudOfferTermsValidationError = {
  field: string;
  code: StudOfferTermsErrorCode;
  message: string;
};

export type StudOfferTermsValidationResult = {
  valid: boolean;
  errors: StudOfferTermsValidationError[];
};

export type StudContractCashAmountValidationResult = {
  valid: boolean;
  error: StudOfferTermsValidationError | null;
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

export function validateStudContractCashAmount(
  value: unknown
): StudContractCashAmountValidationResult {
  if (value === null || value === undefined) {
    return {
      valid: false,
      error: {
        field: "cashAmount",
        code: "CASH_AMOUNT_REQUIRED",
        message: "Cash compensation requires a whole-dollar amount of at least $1.",
      },
    };
  }

  if (!Number.isSafeInteger(value) || value < 1) {
    return {
      valid: false,
      error: {
        field: "cashAmount",
        code: "INVALID_CASH_AMOUNT",
        message: "Cash compensation must be a whole-dollar amount of at least $1.",
      },
    };
  }

  if (value > MAX_STUD_CONTRACT_CASH_AMOUNT) {
    return {
      valid: false,
      error: {
        field: "cashAmount",
        code: "CASH_AMOUNT_TOO_HIGH",
        message: "Stud contract cash compensation cannot exceed $1,000,000.",
      },
    };
  }

  return { valid: true, error: null };
}

export function validateStudOfferCompensationStep(
  terms: Pick<EditableStudOfferTerms, "compensationType" | "cashAmount">
): StudOfferTermsValidationResult {
  const errors: StudOfferTermsValidationError[] = [];

  if (!includesValue(STUD_COMPENSATION_TYPES, terms.compensationType)) {
    addError(errors, "compensationType", "INVALID_COMPENSATION_TYPE", "Choose a valid compensation type.");
  } else if (requiresCash(terms.compensationType)) {
    const cashValidation = validateStudContractCashAmount(terms.cashAmount);
    if (cashValidation.error) errors.push(cashValidation.error);
  }

  return { valid: errors.length === 0, errors };
}

export function validateStudOfferPuppyBackTermsStep(
  terms: Pick<
    EditableStudOfferTerms,
    | "compensationType"
    | "puppyPickPosition"
    | "puppySex"
    | "minimumLitterSize"
  >
): StudOfferTermsValidationResult {
  const errors: StudOfferTermsValidationError[] = [];

  if (!hasPuppyBack(terms.compensationType)) {
    addError(
      errors,
      "compensationType",
      "INVALID_COMPENSATION_TYPE",
      "Puppy-Back terms require Puppy Back compensation."
    );
    return { valid: false, errors };
  }

  if (!includesValue(STUD_PUPPY_PICK_POSITIONS, terms.puppyPickPosition)) {
    addError(
      errors,
      "puppyPickPosition",
      terms.puppyPickPosition === null
        ? "PUPPY_PICK_REQUIRED"
        : "INVALID_PUPPY_PICK",
      "Choose First Pick or Second Pick."
    );
  }
  if (!includesValue(STUD_PUPPY_SEX_REQUIREMENTS, terms.puppySex)) {
    addError(
      errors,
      "puppySex",
      terms.puppySex === null ? "PUPPY_SEX_REQUIRED" : "INVALID_PUPPY_SEX",
      "Choose whether the puppy must be male, female, or either sex."
    );
  }
  if (terms.minimumLitterSize === null) {
    addError(
      errors,
      "minimumLitterSize",
      "MINIMUM_LITTER_REQUIRED",
      "Choose a minimum qualifying litter size."
    );
  } else if (!includesValue(STUD_MINIMUM_LITTER_SIZES, terms.minimumLitterSize)) {
    addError(
      errors,
      "minimumLitterSize",
      "INVALID_MINIMUM_LITTER_SIZE",
      "Minimum litter size must be 1, 2, or 3."
    );
  } else if (
    terms.puppyPickPosition === "SECOND" &&
    terms.minimumLitterSize === 1
  ) {
    addError(
      errors,
      "minimumLitterSize",
      "SECOND_PICK_REQUIRES_MINIMUM_TWO",
      "Second Pick requires at least 2 surviving puppies."
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateStudOfferReturnServiceStep(
  terms: Pick<
    EditableStudOfferTerms,
    "noLitterReturnService" | "smallLitterReturnThreshold"
  >,
  answers: {
    noLitterReturnServiceAnswered: boolean;
    smallLitterReturnThresholdAnswered: boolean;
  }
): StudOfferTermsValidationResult {
  const errors: StudOfferTermsValidationError[] = [];

  if (!answers.noLitterReturnServiceAnswered) {
    addError(
      errors,
      "noLitterReturnService",
      "NO_LITTER_RETURN_SERVICE_REQUIRED",
      "Choose whether no-litter return service is offered."
    );
  } else if (typeof terms.noLitterReturnService !== "boolean") {
    addError(
      errors,
      "noLitterReturnService",
      "INVALID_NO_LITTER_RETURN_SERVICE",
      "No-litter return service must be offered or not offered."
    );
  }

  if (!answers.smallLitterReturnThresholdAnswered) {
    addError(
      errors,
      "smallLitterReturnThreshold",
      "SMALL_LITTER_RETURN_SERVICE_REQUIRED",
      "Choose a small-litter return service setting."
    );
  } else if (!isValidSmallLitterReturnThreshold(terms.smallLitterReturnThreshold)) {
    addError(
      errors,
      "smallLitterReturnThreshold",
      "INVALID_SMALL_LITTER_RETURN_THRESHOLD",
      "Small-litter return threshold must be 1, 2, 3, or omitted."
    );
  }

  return { valid: errors.length === 0, errors };
}

export type StudOfferDamRequirementsAnswers = {
  brucellosisNegativeRequiredAnswered: boolean;
  titleRequirementAnswered: boolean;
  healthRequirementAnsweredCodes: readonly string[];
};

export function validateStudOfferDamRequirementsStep(
  terms: Pick<
    EditableStudOfferTerms,
    | "brucellosisNegativeRequired"
    | "healthRequirements"
    | "titleRequirement"
  >,
  applicableHealthTestCodes: readonly string[],
  answers: StudOfferDamRequirementsAnswers
): StudOfferTermsValidationResult {
  const errors: StudOfferTermsValidationError[] = [];
  const applicableCodes = new Set(applicableHealthTestCodes);
  const answeredCodes = new Set(answers.healthRequirementAnsweredCodes);
  const seenCodes = new Set<string>();

  if (!answers.brucellosisNegativeRequiredAnswered) {
    addError(
      errors,
      "brucellosisNegativeRequired",
      "BRUCELLOSIS_REQUIREMENT_REQUIRED",
      "Choose whether a negative brucellosis result is required."
    );
  } else if (typeof terms.brucellosisNegativeRequired !== "boolean") {
    addError(
      errors,
      "brucellosisNegativeRequired",
      "INVALID_BRUCELLOSIS_REQUIREMENT",
      "Brucellosis requirement must be on or off."
    );
  }

  if (!answers.titleRequirementAnswered) {
    addError(
      errors,
      "titleRequirement",
      "TITLE_REQUIREMENT_REQUIRED",
      "Choose a title requirement."
    );
  } else if (!includesValue(STUD_TITLE_REQUIREMENTS, terms.titleRequirement)) {
    addError(
      errors,
      "titleRequirement",
      "INVALID_TITLE_REQUIREMENT",
      "Choose a valid title requirement."
    );
  }

  for (const requirement of terms.healthRequirements) {
    const code = requirement.healthTestCode;
    const field = `healthRequirements.${code || "unknown"}`;

    if (!code || code.trim() !== code) {
      addError(errors, `${field}.healthTestCode`, "HEALTH_TEST_CODE_REQUIRED", "Health test code is required.");
      continue;
    }
    if (seenCodes.has(code)) {
      addError(errors, `${field}.healthTestCode`, "DUPLICATE_HEALTH_TEST_REQUIREMENT", "Each health test may have only one requirement.");
      continue;
    }
    seenCodes.add(code);

    if (!applicableCodes.has(code)) {
      addError(errors, `${field}.healthTestCode`, "UNEXPECTED_HEALTH_TEST_REQUIREMENT", "Health requirement is not applicable to this breed.");
    }
    if (!includesValue(STUD_HEALTH_REQUIREMENT_LEVELS, requirement.requirementLevel)) {
      addError(errors, `${field}.requirementLevel`, "INVALID_HEALTH_REQUIREMENT_LEVEL", "Choose a valid health requirement level.");
    }
  }

  for (const code of applicableHealthTestCodes) {
    if (!seenCodes.has(code) || !answeredCodes.has(code)) {
      addError(
        errors,
        `healthRequirements.${code}`,
        "HEALTH_REQUIREMENT_REQUIRED",
        "Choose a health requirement for this test."
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateStudOfferApprovalStep(
  terms: Pick<EditableStudOfferTerms, "approvalMode">
): StudOfferTermsValidationResult {
  const errors: StudOfferTermsValidationError[] = [];

  if (terms.approvalMode === null) {
    addError(
      errors,
      "approvalMode",
      "APPROVAL_MODE_REQUIRED",
      "Choose Automatic Approval or Manual Approval."
    );
  } else if (!includesValue(STUD_APPROVAL_MODES, terms.approvalMode)) {
    addError(
      errors,
      "approvalMode",
      "INVALID_APPROVAL_MODE",
      "Choose a valid approval mode."
    );
  }

  return { valid: errors.length === 0, errors };
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

  if (cashRequired) {
    const cashValidation = validateStudContractCashAmount(terms.cashAmount);
    if (cashValidation.error) errors.push(cashValidation.error);
  } else if (!cashRequired && terms.cashAmount !== null) {
    addError(errors, "cashAmount", "CASH_AMOUNT_NOT_ALLOWED", "Cash compensation is not allowed for Puppy Back terms.");
  }

  if (puppyBackRequired) {
    errors.push(...validateStudOfferPuppyBackTermsStep(terms).errors);
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
