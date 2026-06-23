import {
  JUDGING_CATEGORIES,
  type JudgingCategory,
} from "../constants/judging.constants";
import { MIN_SHOW_AGE_HOURS } from "../constants/lifecycle.constants";
import { SHOW_YEAR_HOURS } from "../constants/time.constants";
import {
  TRAIT_IDEAL,
  TRAIT_MAX,
  TRAIT_MIN,
} from "../constants/genetics.constants";
import type { Dog, DogPresentationInfluences } from "./dog.engine";
import type { ShowCharacteristics } from "./judging.engine";

export type PresentationModifierSource =
  | "YOUTH"
  | "PAST_PRIME"
  | "LATE_PREGNANCY"
  | "POST_WHELP"
  | "CONDITIONING"
  | "GROOMING"
  | "HANDLING";

export type PresentationModifierDetail = {
  source: PresentationModifierSource;
  multiplier: number;
};

export type PresentedCategoryDetail = {
  category: JudgingCategory;
  baseValue: number;
  presentedValue: number;
  multiplier: number;
  modifiers: PresentationModifierDetail[];
};

export type PresentationModifierResult = {
  characteristics: ShowCharacteristics;
  details: Record<JudgingCategory, PresentedCategoryDetail>;
};

const PRIME_START_HOURS = 2 * SHOW_YEAR_HOURS;
const PRIME_END_HOURS = 4 * SHOW_YEAR_HOURS;
const SENIOR_HEAVY_INFLUENCE_HOURS = 9 * SHOW_YEAR_HOURS;
const LATE_PREGNANCY_WINDOW_HOURS = 28;
const POST_WHELP_PRESENTATION_WINDOW_HOURS = 90;

const YOUTH_MAX_MULTIPLIER: Record<JudgingCategory, number> = {
  TYPE_EXPRESSION: 1.15,
  STRUCTURE_BALANCE: 1.45,
  MOVEMENT: 1.65,
  COAT_PRESENTATION: 1.35,
  TEMPERAMENT_RING_BEHAVIOR: 1.2,
  CONDITIONING_HANDLING: 1.45,
};

const SENIOR_MAX_MULTIPLIER: Record<JudgingCategory, number> = {
  TYPE_EXPRESSION: 1.65,
  STRUCTURE_BALANCE: 3.4,
  MOVEMENT: 4.0,
  COAT_PRESENTATION: 3.2,
  TEMPERAMENT_RING_BEHAVIOR: 1.55,
  CONDITIONING_HANDLING: 3.7,
};

const LATE_PREGNANCY_MAX_MULTIPLIER: Record<JudgingCategory, number> = {
  TYPE_EXPRESSION: 1.08,
  STRUCTURE_BALANCE: 1.2,
  MOVEMENT: 1.55,
  COAT_PRESENTATION: 1.35,
  TEMPERAMENT_RING_BEHAVIOR: 1.05,
  CONDITIONING_HANDLING: 1.55,
};

const POST_WHELP_MAX_MULTIPLIER: Record<JudgingCategory, number> = {
  TYPE_EXPRESSION: 1.08,
  STRUCTURE_BALANCE: 1.18,
  MOVEMENT: 1.45,
  COAT_PRESENTATION: 1.6,
  TEMPERAMENT_RING_BEHAVIOR: 1.05,
  CONDITIONING_HANDLING: 1.55,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundPresentation(value: number): number {
  return Number(value.toFixed(2));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

function smoothStep(t: number): number {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function getAgePresentationModifier(args: {
  category: JudgingCategory;
  ageHours: number;
}): PresentationModifierDetail | null {
  const { category, ageHours } = args;

  if (ageHours < PRIME_START_HOURS) {
    const t = smoothStep(
      (ageHours - MIN_SHOW_AGE_HOURS) /
        (PRIME_START_HOURS - MIN_SHOW_AGE_HOURS)
    );
    const multiplier = lerp(YOUTH_MAX_MULTIPLIER[category], 1, t);

    return {
      source: "YOUTH",
      multiplier,
    };
  }

  if (ageHours <= PRIME_END_HOURS) {
    return null;
  }

  const seniorT = clamp(
    (ageHours - PRIME_END_HOURS) /
      (SENIOR_HEAVY_INFLUENCE_HOURS - PRIME_END_HOURS),
    0,
    1
  );

  return {
    source: "PAST_PRIME",
    multiplier: lerp(1, SENIOR_MAX_MULTIPLIER[category], seniorT * seniorT),
  };
}

function getPregnancyModifier(args: {
  category: JudgingCategory;
  showEpoch: number;
  dueEpoch?: number | null;
}): PresentationModifierDetail | null {
  const { category, showEpoch, dueEpoch } = args;

  if (dueEpoch == null) {
    return null;
  }

  const windowStart = dueEpoch - LATE_PREGNANCY_WINDOW_HOURS;

  if (showEpoch < windowStart || showEpoch >= dueEpoch) {
    return null;
  }

  const t = (showEpoch - windowStart) / LATE_PREGNANCY_WINDOW_HOURS;

  return {
    source: "LATE_PREGNANCY",
    multiplier: lerp(1, LATE_PREGNANCY_MAX_MULTIPLIER[category], t),
  };
}

function getPostWhelpModifier(args: {
  category: JudgingCategory;
  showEpoch: number;
  lastWhelpedEpoch?: number | null;
}): PresentationModifierDetail | null {
  const { category, showEpoch, lastWhelpedEpoch } = args;

  if (lastWhelpedEpoch == null || showEpoch < lastWhelpedEpoch) {
    return null;
  }

  const elapsed = showEpoch - lastWhelpedEpoch;

  if (elapsed > POST_WHELP_PRESENTATION_WINDOW_HOURS) {
    return null;
  }

  const t = 1 - elapsed / POST_WHELP_PRESENTATION_WINDOW_HOURS;

  return {
    source: "POST_WHELP",
    multiplier: lerp(1, POST_WHELP_MAX_MULTIPLIER[category], t),
  };
}

function getOptionalCategoryModifier(args: {
  source: PresentationModifierSource;
  category: JudgingCategory;
  multiplierByCategory?: Partial<Record<JudgingCategory, number>>;
}): PresentationModifierDetail | null {
  const multiplier = args.multiplierByCategory?.[args.category];

  if (multiplier == null || multiplier === 1) {
    return null;
  }

  return {
    source: args.source,
    multiplier,
  };
}

export function getPresentationModifiersForCategory(args: {
  category: JudgingCategory;
  dog: Dog;
  showEpoch: number;
  influences?: DogPresentationInfluences;
}): PresentationModifierDetail[] {
  const influences = {
    ...args.dog.presentation,
    ...args.influences,
  };
  const ageHours = args.showEpoch - args.dog.birthEpoch;
  const modifiers = [
    getAgePresentationModifier({
      category: args.category,
      ageHours,
    }),
    getPregnancyModifier({
      category: args.category,
      showEpoch: args.showEpoch,
      dueEpoch: influences.dueEpoch,
    }),
    getPostWhelpModifier({
      category: args.category,
      showEpoch: args.showEpoch,
      lastWhelpedEpoch: influences.lastWhelpedEpoch,
    }),
    getOptionalCategoryModifier({
      source: "CONDITIONING",
      category: args.category,
      multiplierByCategory: influences.conditioningMultiplierByCategory,
    }),
    getOptionalCategoryModifier({
      source: "GROOMING",
      category: args.category,
      multiplierByCategory: influences.groomingMultiplierByCategory,
    }),
    getOptionalCategoryModifier({
      source: "HANDLING",
      category: args.category,
      multiplierByCategory: influences.handlingMultiplierByCategory,
    }),
  ];

  return modifiers.filter(
    (modifier): modifier is PresentationModifierDetail => modifier !== null
  );
}

export function applyPresentationMultiplier(
  value: number,
  multiplier: number
): number {
  const presentedValue = TRAIT_IDEAL + (value - TRAIT_IDEAL) * multiplier;

  return roundPresentation(clamp(presentedValue, TRAIT_MIN, TRAIT_MAX));
}

export function applyPresentationModifiersToCharacteristics(args: {
  characteristics: ShowCharacteristics;
  dog: Dog;
  showEpoch: number;
  influences?: DogPresentationInfluences;
}): PresentationModifierResult {
  const characteristics = {} as ShowCharacteristics;
  const details = {} as Record<JudgingCategory, PresentedCategoryDetail>;

  for (const category of JUDGING_CATEGORIES) {
    const baseValue = args.characteristics[category];
    const modifiers = getPresentationModifiersForCategory({
      category,
      dog: args.dog,
      showEpoch: args.showEpoch,
      influences: args.influences,
    });
    const multiplier = modifiers.reduce(
      (total, modifier) => total * modifier.multiplier,
      1
    );
    const presentedValue = applyPresentationMultiplier(baseValue, multiplier);

    characteristics[category] = presentedValue;
    details[category] = {
      category,
      baseValue,
      presentedValue,
      multiplier: roundPresentation(multiplier),
      modifiers: modifiers.map((modifier) => ({
        ...modifier,
        multiplier: roundPresentation(modifier.multiplier),
      })),
    };
  }

  return {
    characteristics,
    details,
  };
}
