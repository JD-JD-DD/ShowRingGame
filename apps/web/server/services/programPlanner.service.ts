import type { DogPlannerTagType } from "@prisma/client";
import {
  DAM_MAX_BREED_AGE_HOURS,
  MAX_SHOW_AGE_HOURS,
  MIN_BREED_AGE_HOURS,
  MIN_SHOW_AGE_HOURS,
  PHENOTYPE_HEALTH_TEST_CODES,
  PHENOTYPE_HEALTH_TESTS,
  WHELPING_COOLDOWN_HOURS,
  deriveConditioningHandlingScore,
  deriveVisibleCategoriesFromTraits,
} from "@showring/rules";

import { getPhenotypeHealthSeverity } from "@/lib/dogHealth";
import { db } from "@/lib/db";
import {
  PLAYER_SALE_LISTING_TYPE,
  PLAYER_STUD_LISTING_TYPE,
} from "@/server/services/market.service";

export type ProgramPlannerTagType =
  | "KEEP"
  | "WATCH"
  | "SELL_CANDIDATE"
  | "REHOME_CANDIDATE"
  | "NO_ACTION";

type VisibleCategoryKey =
  | "typeExpression"
  | "structureBalance"
  | "movement"
  | "coatPresentation"
  | "temperamentRingBehavior"
  | "conditioningHandling";

type VisibleCategories = Record<VisibleCategoryKey, number>;

type Direction = "under" | "near" | "over";

type PlannerDogRecord = Awaited<
  ReturnType<typeof fetchProgramPlannerDogs>
>[number];

export const PROGRAM_PLANNER_GOALS = [
  {
    key: "balanced-show-prospects",
    label: "Build toward balanced show prospects",
  },
  { key: "improve-movement", label: "Improve Movement" },
  { key: "improve-type-expression", label: "Improve Type & Expression" },
  {
    key: "improve-structure-balance",
    label: "Improve Structure & Balance",
  },
  { key: "improve-coat-presentation", label: "Improve Coat & Presentation" },
  { key: "preserve-current-line", label: "Preserve current line" },
  { key: "reduce-kennel-size", label: "Reduce kennel size" },
  { key: "keep-breeding-options-open", label: "Keep breeding options open" },
  { key: "keep-show-ready-dogs", label: "Keep show-ready dogs" },
  { key: "review-litter-prospects", label: "Review litter prospects" },
  {
    key: "find-non-contributors",
    label: "Find dogs not contributing to the program",
  },
] as const;

const CATEGORY_LABELS: Record<VisibleCategoryKey, string> = {
  typeExpression: "Type & Expression",
  structureBalance: "Structure & Balance",
  movement: "Movement",
  coatPresentation: "Coat & Presentation",
  temperamentRingBehavior: "Temperament & Ring Behavior",
  conditioningHandling: "Conditioning & Handling",
};

const GENETIC_CATEGORY_KEYS: VisibleCategoryKey[] = [
  "typeExpression",
  "structureBalance",
  "movement",
  "coatPresentation",
  "temperamentRingBehavior",
];

const ALL_CATEGORY_KEYS: VisibleCategoryKey[] = [
  ...GENETIC_CATEGORY_KEYS,
  "conditioningHandling",
];

const GOAL_CATEGORY_BY_KEY: Record<string, VisibleCategoryKey | null> = {
  "improve-movement": "movement",
  "improve-type-expression": "typeExpression",
  "improve-structure-balance": "structureBalance",
  "improve-coat-presentation": "coatPresentation",
};

const TAG_TYPES = new Set<ProgramPlannerTagType>([
  "KEEP",
  "WATCH",
  "SELL_CANDIDATE",
  "REHOME_CANDIDATE",
  "NO_ACTION",
]);

function directionForValue(value: number): Direction {
  if (value < 9.25) return "under";
  if (value > 10.75) return "over";
  return "near";
}

function directionLabel(value: number): "under ideal" | "near ideal" | "over ideal" {
  const direction = directionForValue(value);
  if (direction === "under") return "under ideal";
  if (direction === "over") return "over ideal";
  return "near ideal";
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatAge(ageHours: number) {
  const years = Math.floor(ageHours / 365);
  const weeks = Math.floor((ageHours % 365) / 7);

  if (years > 0) {
    return `${years} yr${years === 1 ? "" : "s"} ${weeks} wk${
      weeks === 1 ? "" : "s"
    }`;
  }

  return `${Math.max(0, weeks)} wk${weeks === 1 ? "" : "s"}`;
}

function ageClass(ageHours: number) {
  if (ageHours < MIN_SHOW_AGE_HOURS) return "Puppy";
  if (ageHours < MIN_BREED_AGE_HOURS) return "Junior";
  if (ageHours <= MAX_SHOW_AGE_HOURS) return "Adult";
  return "Veteran";
}

function displayName(dog: {
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
}) {
  return dog.callName ?? dog.registeredName ?? dog.regNumber;
}

function titledName(dog: {
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
}) {
  const base = displayName(dog);
  return [dog.visibleTitlePrefix, base, dog.visibleTitleSuffix]
    .filter(Boolean)
    .join(" ");
}

function toVisibleCategories(dog: {
  traitHead: number;
  traitForequarters: number;
  traitHindquarters: number;
  traitGait: number;
  traitCoat: number;
  traitSize: number;
  traitTemperament: number;
  traitShowShine: number;
  traitFeet: number;
  traitTopline: number;
  ringObedience: number;
  muscleTone: number;
  coatCondition: number;
  fatiguePoints: number;
}): VisibleCategories {
  return {
    ...deriveVisibleCategoriesFromTraits({
      head: dog.traitHead,
      forequarters: dog.traitForequarters,
      hindquarters: dog.traitHindquarters,
      gait: dog.traitGait,
      coat: dog.traitCoat,
      size: dog.traitSize,
      temperament: dog.traitTemperament,
      show_shine: dog.traitShowShine,
      feet: dog.traitFeet,
      topline: dog.traitTopline,
    }),
    conditioningHandling: deriveConditioningHandlingScore({
      coatCondition: dog.coatCondition,
      muscleTone: dog.muscleTone,
      ringObedience: dog.ringObedience,
      fatiguePoints: dog.fatiguePoints,
    }),
  };
}

function latestPhenotypeTests(
  tests: Array<{
    testTypeCode: string;
    resultCode: string;
    testedAtEpoch: number | null;
    createdAt: Date;
  }>
) {
  const latest = new Map<string, { testTypeCode: string; resultCode: string }>();

  for (const test of tests) {
    if (!PHENOTYPE_HEALTH_TEST_CODES.includes(test.testTypeCode as never)) {
      continue;
    }

    if (!latest.has(test.testTypeCode)) {
      latest.set(test.testTypeCode, {
        testTypeCode: test.testTypeCode,
        resultCode: test.resultCode,
      });
    }
  }

  return latest;
}

function healthSummary(
  ageHours: number,
  tests: Array<{
    testTypeCode: string;
    resultCode: string;
    testedAtEpoch: number | null;
    createdAt: Date;
  }>
) {
  const latest = latestPhenotypeTests(tests);
  const eligibleCodes = PHENOTYPE_HEALTH_TEST_CODES.filter(
    (code) => ageHours >= PHENOTYPE_HEALTH_TESTS[code].minimumAgeHours
  );
  const eligibleMissing = eligibleCodes.filter((code) => !latest.has(code));
  const concerns = [...latest.values()].filter((test) => {
    const severity = getPhenotypeHealthSeverity(
      test.testTypeCode,
      test.resultCode
    );
    return severity === "yellow" || severity === "red";
  });

  if (concerns.length > 0) {
    return {
      status: "concern" as const,
      label: "Has concern",
      eligibleCount: eligibleCodes.length,
      completeCount: eligibleCodes.length - eligibleMissing.length,
      concernCount: concerns.length,
    };
  }

  if (eligibleCodes.length === 0) {
    return {
      status: "too_young" as const,
      label: "Too young to test",
      eligibleCount: 0,
      completeCount: 0,
      concernCount: 0,
    };
  }

  if (eligibleMissing.length > 0) {
    return {
      status: "eligible_incomplete" as const,
      label: "Eligible, incomplete",
      eligibleCount: eligibleCodes.length,
      completeCount: eligibleCodes.length - eligibleMissing.length,
      concernCount: 0,
    };
  }

  return {
    status: "complete" as const,
    label: "Complete",
    eligibleCount: eligibleCodes.length,
    completeCount: eligibleCodes.length,
    concernCount: 0,
  };
}

function canBreedDog(dog: PlannerDogRecord, ageHours: number, currentEpoch: number) {
  if (dog.lifecycleState !== "ALIVE") return false;
  if (ageHours < MIN_BREED_AGE_HOURS) return false;
  if (dog.sex === "F" && ageHours > DAM_MAX_BREED_AGE_HOURS) return false;
  if (
    dog.sex === "F" &&
    dog.breedingAttemptsAsDam.some((attempt) =>
      ["INITIATED", "PREGNANT"].includes(attempt.status)
    )
  ) {
    return false;
  }

  const lastWhelped = dog.dammedLitters[0]?.bornEpoch ?? null;
  return lastWhelped === null || currentEpoch >= lastWhelped + WHELPING_COOLDOWN_HOURS;
}

function canShowDog(dog: PlannerDogRecord, ageHours: number) {
  return (
    dog.lifecycleState === "ALIVE" &&
    ageHours >= MIN_SHOW_AGE_HOURS &&
    ageHours <= MAX_SHOW_AGE_HOURS &&
    !dog.breedingAttemptsAsDam.some((attempt) => attempt.status === "PREGNANT")
  );
}

function roleSignature(dog: {
  sex: "M" | "F";
  ageClass: string;
  visibleCategories: VisibleCategories;
}) {
  return [
    dog.sex,
    dog.ageClass,
    ...GENETIC_CATEGORY_KEYS.map((key) =>
      directionForValue(dog.visibleCategories[key])
    ),
  ].join("|");
}

function categoryDistance(a: VisibleCategories, b: VisibleCategories) {
  return average(
    GENETIC_CATEGORY_KEYS.map((key) => Math.abs(a[key] - b[key]))
  );
}

function buildDogContext(
  dogs: Array<{
    dogId: string;
    sex: "M" | "F";
    ageClass: string;
    visibleCategories: VisibleCategories;
  }>
) {
  const signatureCounts = new Map<string, number>();

  for (const dog of dogs) {
    const signature = roleSignature(dog);
    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
  }

  return {
    similarCounts: new Map(
      dogs.map((dog) => [
        dog.dogId,
        Math.max(0, (signatureCounts.get(roleSignature(dog)) ?? 1) - 1),
      ])
    ),
    closeProfileCounts: new Map(
      dogs.map((dog) => [
        dog.dogId,
        dogs.filter(
          (other) =>
            other.dogId !== dog.dogId &&
            categoryDistance(dog.visibleCategories, other.visibleCategories) <=
              1.2
        ).length,
      ])
    ),
  };
}

function goalFitForDog(args: {
  dog: ProgramPlannerDogDto;
  goalKey: string | null;
  similarCount: number;
  closeProfileCount: number;
  adultMaleCount: number;
  adultFemaleCount: number;
}) {
  const { dog, goalKey, similarCount, closeProfileCount } = args;
  const tags = new Set<string>();
  const warnings = new Set<string>();
  let label = goalKey ? "Neutral / flexible" : "Select a program goal";

  const goalCategory = goalKey ? GOAL_CATEGORY_BY_KEY[goalKey] : null;
  const goalCategoryLabel = goalCategory ? CATEGORY_LABELS[goalCategory] : null;
  const goalCategoryDirection = goalCategory
    ? directionLabel(dog.visibleCategories[goalCategory])
    : null;

  if (goalCategory && goalCategoryLabel && goalCategoryDirection) {
    tags.add(`${goalCategoryDirection} ${goalCategoryLabel}`);
    if (goalCategoryDirection === "near ideal") {
      label =
        dog.healthSummary.status === "complete"
          ? "Strong fit for selected goal"
          : "Supports selected goal";
    } else {
      label = "Watch";
      tags.add("Useful different profile");
    }
  }

  if (goalKey === "balanced-show-prospects") {
    const nearCount = GENETIC_CATEGORY_KEYS.filter(
      (key) => directionForValue(dog.visibleCategories[key]) === "near"
    ).length;
    tags.add(`${nearCount} visible categories near ideal`);
    label =
      nearCount >= 4 && dog.showSummary.isShowEligible
        ? "Strong fit for selected goal"
        : nearCount >= 3
          ? "Supports selected goal"
          : "Neutral / flexible";
  }

  if (goalKey === "preserve-current-line") {
    if (dog.breedingSummary.canBreed || dog.breedingSummary.alreadyBred) {
      label = "Supports selected goal";
      tags.add("Breeding option");
    }
    if (dog.litter?.serial7 || dog.sire || dog.dam) {
      tags.add("Line context visible");
    }
  }

  if (goalKey === "reduce-kennel-size" || goalKey === "find-non-contributors") {
    if (
      !dog.showSummary.isChampion &&
      !dog.showSummary.isPointed &&
      !dog.breedingSummary.canBreed &&
      closeProfileCount > 0
    ) {
      label = "Low fit for selected goal";
      tags.add("Inactive / review candidate");
    } else {
      label = "Player decision needed";
    }
  }

  if (goalKey === "keep-breeding-options-open") {
    label = dog.breedingSummary.canBreed
      ? "Supports selected goal"
      : "Neutral / flexible";
    if (dog.breedingSummary.canBreed) tags.add("Breeding option");
  }

  if (goalKey === "keep-show-ready-dogs") {
    label = dog.showSummary.isShowEligible
      ? "Supports selected goal"
      : "Neutral / flexible";
    if (dog.showSummary.isChampion) tags.add("Champion show record");
    if (dog.showSummary.isPointed) tags.add("Pointed show record");
  }

  if (goalKey === "review-litter-prospects") {
    if (dog.ageClass === "Puppy" || dog.ageClass === "Junior") {
      label = "Supports selected goal";
      tags.add("Young prospect");
    } else {
      label = "Neutral / flexible";
    }
  }

  if (dog.healthSummary.status === "eligible_incomplete") {
    tags.add("Needs health review");
  }

  if (dog.healthSummary.status === "concern") {
    tags.add("Health concern");
    warnings.add("Review health status before making a final placement decision.");
  }

  if (dog.showSummary.isChampion) {
    tags.add("Show record supports keeping");
  }

  if (dog.marketSummary.isListedForSale) tags.add("Currently For Sale");
  if (dog.marketSummary.isListedAtStud) tags.add("At Stud");
  if (dog.breedingSummary.pregnant) tags.add("Already part of breeding plan");
  if (dog.breedingSummary.recentLitter) tags.add("Recent Litter");

  if (similarCount > 0 || closeProfileCount > 0) {
    tags.add(
      `Similar visible profile to ${Math.max(
        similarCount,
        closeProfileCount
      )} other dog${Math.max(similarCount, closeProfileCount) === 1 ? "" : "s"}`
    );
  }

  if (dog.sex === "F" && dog.ageClass === "Adult" && args.adultFemaleCount === 1) {
    tags.add("Only Adult Female");
    warnings.add(
      "Review carefully before re-home: this dog currently preserves an adult female breeding option."
    );
  }

  if (dog.sex === "M" && dog.ageClass === "Adult" && args.adultMaleCount === 1) {
    tags.add("Only Adult Male");
  }

  if (dog.ageClass === "Veteran") {
    tags.add("Veteran / Aging Out");
  }

  if (tags.size === 0 && goalKey) {
    tags.add("Player decision needed");
  }

  return {
    goalFitLabel: label,
    reasonTags: [...tags],
    warningTags: [...warnings],
  };
}

function patternSummary(args: {
  dogs: ProgramPlannerDogDto[];
  breedName: string;
  goalKey: string | null;
}) {
  const { dogs, breedName, goalKey } = args;

  if (dogs.length === 0) return [];

  const patterns: string[] = [];
  const males = dogs.filter((dog) => dog.sex === "M").length;
  const females = dogs.length - males;
  const adultMales = dogs.filter(
    (dog) => dog.sex === "M" && dog.ageClass === "Adult"
  ).length;
  const adultFemales = dogs.filter(
    (dog) => dog.sex === "F" && dog.ageClass === "Adult"
  ).length;
  const youngDogs = dogs.filter(
    (dog) => dog.ageClass === "Puppy" || dog.ageClass === "Junior"
  ).length;
  const matureDogs = dogs.length - youngDogs;

  if (males > females + 1) {
    patterns.push(`You have more males than females in this ${breedName} group.`);
  } else if (females > males + 1) {
    patterns.push(`You have more females than males in this ${breedName} group.`);
  }

  if (adultMales >= adultFemales + 2) {
    patterns.push("You have more adult males than adult females in this breed.");
  }

  if (matureDogs >= youngDogs * 2 && dogs.length >= 3) {
    patterns.push(
      "This breed group is heavy on mature dogs and light on young prospects."
    );
  }

  const categoryStats = GENETIC_CATEGORY_KEYS.map((key) => {
    const values = dogs.map((dog) => dog.visibleCategories[key]);
    const low = Math.min(...values);
    const high = Math.max(...values);
    return {
      key,
      label: CATEGORY_LABELS[key],
      spread: high - low,
      under: values.filter((value) => directionForValue(value) === "under")
        .length,
      near: values.filter((value) => directionForValue(value) === "near").length,
      over: values.filter((value) => directionForValue(value) === "over").length,
    };
  });

  const widest = [...categoryStats].sort((a, b) => b.spread - a.spread)[0];
  if (widest && widest.spread >= 3) {
    patterns.push(
      `${widest.label} is the widest-spread visible category in this breed group.`
    );
  }

  for (const stat of categoryStats) {
    if (stat.over >= Math.ceil(dogs.length * 0.45) && stat.over >= 2) {
      patterns.push(
        `Most of your ${breedName} dogs are clustered over ideal in ${stat.label}.`
      );
      break;
    }
    if (stat.under >= Math.ceil(dogs.length * 0.45) && stat.under >= 2) {
      patterns.push(
        `Most of your ${breedName} dogs are clustered under ideal in ${stat.label}.`
      );
      break;
    }
  }

  const goalCategory = goalKey ? GOAL_CATEGORY_BY_KEY[goalKey] : null;
  if (goalCategory) {
    const youngFemalesNearGoal = dogs.filter(
      (dog) =>
        dog.sex === "F" &&
        (dog.ageClass === "Puppy" || dog.ageClass === "Junior") &&
        directionForValue(dog.visibleCategories[goalCategory]) === "near"
    ).length;

    if (youngFemalesNearGoal === 0) {
      patterns.push(
        `You have no young females near ideal in ${CATEGORY_LABELS[goalCategory]}.`
      );
    }
  }

  const incompleteHealth = dogs.filter(
    (dog) => dog.healthSummary.status === "eligible_incomplete"
  ).length;
  if (incompleteHealth > 0) {
    patterns.push(
      `${incompleteHealth} dog${incompleteHealth === 1 ? " is" : "s are"} eligible but incomplete on health testing.`
    );
  }

  const similarAdultMales = dogs.filter((dog) =>
    dog.reasonTags.some((tag) => tag.startsWith("Similar visible profile"))
  ).length;
  if (similarAdultMales >= 2) {
    patterns.push("Several dogs share similar visible profiles.");
  }

  if (goalKey && dogs.every((dog) => dog.goalFitLabel !== "Strong fit for selected goal")) {
    patterns.push("This selected goal currently has few matching dogs.");
  }

  return patterns.slice(0, 8);
}

function filterCountMetadata(dogs: ProgramPlannerDogDto[]) {
  const counts: Array<{
    group: string;
    key: string;
    label: string;
    count: number;
  }> = [];

  const push = (group: string, key: string, label: string, count: number) => {
    counts.push({ group, key, label, count });
  };

  push("Identity", "sex:M", "Males", dogs.filter((dog) => dog.sex === "M").length);
  push("Identity", "sex:F", "Females", dogs.filter((dog) => dog.sex === "F").length);

  for (const klass of ["Puppy", "Junior", "Adult", "Veteran"]) {
    push(
      "Identity",
      `age:${klass}`,
      klass,
      dogs.filter((dog) => dog.ageClass === klass).length
    );
  }

  push(
    "Purpose",
    "purpose:champion",
    "Champions",
    dogs.filter((dog) => dog.showSummary.isChampion).length
  );
  push(
    "Purpose",
    "purpose:pointed",
    "Pointed",
    dogs.filter((dog) => dog.showSummary.isPointed).length
  );
  push(
    "Purpose",
    "purpose:unshown",
    "Unshown",
    dogs.filter((dog) => dog.showSummary.showEntryCount === 0).length
  );
  push(
    "Purpose",
    "purpose:showEligible",
    "Show eligible now",
    dogs.filter((dog) => dog.showSummary.isShowEligible).length
  );
  push(
    "Purpose",
    "purpose:breedEligible",
    "Breed eligible now",
    dogs.filter((dog) => dog.breedingSummary.canBreed).length
  );

  for (const key of ALL_CATEGORY_KEYS) {
    for (const direction of ["under", "near", "over"] as const) {
      push(
        "Visible categories",
        `category:${key}:${direction}`,
        `${CATEGORY_LABELS[key]} ${direction} ideal`,
        dogs.filter(
          (dog) => directionForValue(dog.visibleCategories[key]) === direction
        ).length
      );
    }
  }

  const healthLabels = [
    ["health:complete", "Complete", "complete"],
    ["health:incomplete", "Eligible, incomplete", "eligible_incomplete"],
    ["health:concern", "Has concern", "concern"],
    ["health:tooYoung", "Too young to test", "too_young"],
  ] as const;

  for (const [key, label, status] of healthLabels) {
    push(
      "Health",
      key,
      label,
      dogs.filter((dog) => dog.healthSummary.status === status).length
    );
  }

  push(
    "Use",
    "use:alreadyBred",
    "Already bred",
    dogs.filter((dog) => dog.breedingSummary.alreadyBred).length
  );
  push(
    "Use",
    "use:inactive",
    "Inactive",
    dogs.filter(
      (dog) =>
        dog.showSummary.showEntryCount === 0 && !dog.breedingSummary.alreadyBred
    ).length
  );
  push(
    "Management",
    "market:forSale",
    "For sale",
    dogs.filter((dog) => dog.marketSummary.isListedForSale).length
  );
  push(
    "Management",
    "market:atStud",
    "At stud",
    dogs.filter((dog) => dog.marketSummary.isListedAtStud).length
  );
  push(
    "Management",
    "reason:duplicate",
    "Duplicate role",
    dogs.filter((dog) =>
      dog.reasonTags.some((tag) => tag.startsWith("Similar visible profile"))
    ).length
  );

  return counts;
}

function finalWarnings(dogs: ProgramPlannerDogDto[]) {
  return [
    {
      key: "rehomeChampions",
      label: "Re-home candidates with champion titles",
      count: dogs.filter(
        (dog) =>
          dog.existingPlannerTag?.tagType === "REHOME_CANDIDATE" &&
          dog.showSummary.isChampion
      ).length,
    },
    {
      key: "rehomeOnlyAdultFemale",
      label: "Re-home candidates that are the only adult female",
      count: dogs.filter(
        (dog) =>
          dog.existingPlannerTag?.tagType === "REHOME_CANDIDATE" &&
          dog.reasonTags.includes("Only Adult Female")
      ).length,
    },
    {
      key: "rehomeHealthIncomplete",
      label: "Re-home candidates incomplete on health testing",
      count: dogs.filter(
        (dog) =>
          dog.existingPlannerTag?.tagType === "REHOME_CANDIDATE" &&
          dog.healthSummary.status === "eligible_incomplete"
      ).length,
    },
    {
      key: "sellBreedingPlan",
      label: "Sell candidates already part of a breeding plan",
      count: dogs.filter(
        (dog) =>
          dog.existingPlannerTag?.tagType === "SELL_CANDIDATE" &&
          dog.breedingSummary.pregnant
      ).length,
    },
    {
      key: "noActionForSale",
      label: "No Action dogs currently for sale",
      count: dogs.filter(
        (dog) =>
          dog.existingPlannerTag?.tagType === "NO_ACTION" &&
          dog.marketSummary.isListedForSale
      ).length,
    },
    {
      key: "rehomeRecentLitter",
      label: "Re-home candidates with a recent litter",
      count: dogs.filter(
        (dog) =>
          dog.existingPlannerTag?.tagType === "REHOME_CANDIDATE" &&
          dog.breedingSummary.recentLitter
      ).length,
    },
  ];
}

async function fetchProgramPlannerDogs(args: {
  kennelId: string;
  breedCode2?: string;
}) {
  return db.dog.findMany({
    where: {
      ownerKennelId: args.kennelId,
      lifecycleState: "ALIVE",
      isPlayerVisible: true,
      ...(args.breedCode2 ? { breedCode2: args.breedCode2 } : {}),
    },
    orderBy: [{ breedCode2: "asc" }, { birthEpoch: "asc" }],
    select: {
      id: true,
      callName: true,
      registeredName: true,
      regNumber: true,
      visibleTitlePrefix: true,
      visibleTitleSuffix: true,
      breedCode2: true,
      sex: true,
      birthEpoch: true,
      lifecycleState: true,
      marketState: true,
      championOffspringCount: true,
      producerMeritLabel: true,
      breed: {
        select: {
          name: true,
          groupName: true,
        },
      },
      ownerKennel: {
        select: {
          id: true,
          name: true,
        },
      },
      breederKennel: {
        select: {
          id: true,
          name: true,
        },
      },
      litter: {
        select: {
          id: true,
          serial7: true,
          bornEpoch: true,
        },
      },
      sire: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
        },
      },
      dam: {
        select: {
          id: true,
          callName: true,
          registeredName: true,
          regNumber: true,
        },
      },
      titleProgress: {
        select: {
          championshipPoints: true,
          majorCount: true,
          currentTitleCode: true,
        },
      },
      showEntries: {
        select: {
          id: true,
          entryStatus: true,
        },
      },
      showResults: {
        select: {
          pointsAwarded: true,
        },
      },
      healthTests: {
        where: {
          isPublic: true,
          testTypeCode: {
            in: [...PHENOTYPE_HEALTH_TEST_CODES],
          },
        },
        orderBy: [
          { testTypeCode: "asc" },
          { testedAtEpoch: "desc" },
          { createdAt: "desc" },
        ],
        select: {
          testTypeCode: true,
          resultCode: true,
          testedAtEpoch: true,
          createdAt: true,
        },
      },
      breedingAttemptsAsDam: {
        orderBy: [{ createdEpoch: "desc" }],
        select: {
          status: true,
          createdEpoch: true,
          dueEpoch: true,
        },
      },
      dammedLitters: {
        orderBy: [{ bornEpoch: "desc" }],
        select: {
          id: true,
          bornEpoch: true,
        },
      },
      siredLitters: {
        orderBy: [{ bornEpoch: "desc" }],
        select: {
          id: true,
          bornEpoch: true,
        },
      },
      listings: {
        where: {
          status: "ACTIVE",
          listingType: {
            in: [PLAYER_SALE_LISTING_TYPE, PLAYER_STUD_LISTING_TYPE],
          },
        },
        select: {
          listingType: true,
        },
      },
      plannerTags: {
        where: {
          kennelId: args.kennelId,
          source: "PROGRAM_PLANNER",
        },
        select: {
          id: true,
          tagType: true,
          goalKey: true,
          note: true,
          isVisibleOnDogPage: true,
          updatedAt: true,
        },
        take: 1,
      },
      traitHead: true,
      traitForequarters: true,
      traitHindquarters: true,
      traitGait: true,
      traitCoat: true,
      traitSize: true,
      traitTemperament: true,
      traitShowShine: true,
      traitFeet: true,
      traitTopline: true,
      ringObedience: true,
      muscleTone: true,
      coatCondition: true,
      fatiguePoints: true,
    },
  });
}

export type ProgramPlannerDogDto = {
  dogId: string;
  displayName: string;
  titledName: string;
  regNumber: string;
  breedCode2: string;
  breedName: string;
  sex: "M" | "F";
  ageHours: number;
  ageLabel: string;
  ageClass: string;
  lifecycleState: string;
  visibleTitlePrefix: string | null;
  visibleTitleSuffix: string | null;
  ownerName: string | null;
  breederName: string | null;
  litter: { id: string; serial7: string; bornEpoch: number } | null;
  sire: { id: string; displayName: string; regNumber: string } | null;
  dam: { id: string; displayName: string; regNumber: string } | null;
  visibleCategories: VisibleCategories;
  healthSummary: ReturnType<typeof healthSummary>;
  showSummary: {
    label: string;
    showEntryCount: number;
    pointCount: number;
    majorCount: number;
    isChampion: boolean;
    isPointed: boolean;
    isShowEligible: boolean;
  };
  breedingSummary: {
    label: string;
    canBreed: boolean;
    alreadyBred: boolean;
    pregnant: boolean;
    cooldown: boolean;
    recentLitter: boolean;
    championOffspringCount: number;
  };
  marketSummary: {
    label: string;
    marketState: string;
    isListedForSale: boolean;
    isListedAtStud: boolean;
  };
  goalFitLabel: string;
  reasonTags: string[];
  warningTags: string[];
  existingPlannerTag: {
    id: string;
    tagType: ProgramPlannerTagType;
    goalKey: string;
    note: string | null;
    isVisibleOnDogPage: boolean;
    updatedAt: string;
  } | null;
};

export async function getProgramPlannerData(args: {
  kennelId: string;
  currentEpoch: number;
  breedCode2?: string | null;
  goalKey?: string | null;
}) {
  const allDogs = await fetchProgramPlannerDogs({ kennelId: args.kennelId });
  const breedCounts = new Map<
    string,
    { breedCode2: string; breedName: string; count: number }
  >();

  for (const dog of allDogs) {
    const current = breedCounts.get(dog.breedCode2) ?? {
      breedCode2: dog.breedCode2,
      breedName: dog.breed.name,
      count: 0,
    };
    current.count += 1;
    breedCounts.set(dog.breedCode2, current);
  }

  const availableBreeds = [...breedCounts.values()].sort((a, b) =>
    a.breedName.localeCompare(b.breedName)
  );
  const selectedBreedCode2 =
    args.breedCode2 && breedCounts.has(args.breedCode2)
      ? args.breedCode2
      : null;
  const selectedDogs = selectedBreedCode2
    ? allDogs.filter((dog) => dog.breedCode2 === selectedBreedCode2)
    : [];

  const baseDogs: ProgramPlannerDogDto[] = selectedDogs.map((dog) => {
    const ageHours = Math.max(0, args.currentEpoch - dog.birthEpoch);
    const dogAgeClass = ageClass(ageHours);
    const visibleCategories = toVisibleCategories(dog);
    const health = healthSummary(ageHours, dog.healthTests);
    const isChampion =
      dog.visibleTitlePrefix?.includes("CH") ||
      dog.titleProgress?.currentTitleCode === "CH";
    const pointCount =
      dog.titleProgress?.championshipPoints ??
      dog.showResults.reduce((sum, result) => sum + result.pointsAwarded, 0);
    const isShowEligible = canShowDog(dog, ageHours);
    const isBreedingEligible = canBreedDog(dog, ageHours, args.currentEpoch);
    const isPregnant = dog.breedingAttemptsAsDam.some(
      (attempt) => attempt.status === "PREGNANT"
    );
    const lastLitterEpoch = dog.dammedLitters[0]?.bornEpoch ?? null;
    const isCoolingDown =
      dog.sex === "F" &&
      lastLitterEpoch !== null &&
      args.currentEpoch < lastLitterEpoch + WHELPING_COOLDOWN_HOURS;
    const recentLitter =
      lastLitterEpoch !== null && args.currentEpoch - lastLitterEpoch <= 90;
    const isListedForSale = dog.listings.some(
      (listing) => listing.listingType === PLAYER_SALE_LISTING_TYPE
    );
    const isListedAtStud = dog.listings.some(
      (listing) => listing.listingType === PLAYER_STUD_LISTING_TYPE
    );

    return {
      dogId: dog.id,
      displayName: displayName(dog),
      titledName: titledName(dog),
      regNumber: dog.regNumber,
      breedCode2: dog.breedCode2,
      breedName: dog.breed.name,
      sex: dog.sex,
      ageHours,
      ageLabel: formatAge(ageHours),
      ageClass: dogAgeClass,
      lifecycleState: dog.lifecycleState,
      visibleTitlePrefix: dog.visibleTitlePrefix,
      visibleTitleSuffix: dog.visibleTitleSuffix,
      ownerName: dog.ownerKennel?.name ?? null,
      breederName: dog.breederKennel?.name ?? null,
      litter: dog.litter,
      sire: dog.sire
        ? {
            id: dog.sire.id,
            displayName: displayName(dog.sire),
            regNumber: dog.sire.regNumber,
          }
        : null,
      dam: dog.dam
        ? {
            id: dog.dam.id,
            displayName: displayName(dog.dam),
            regNumber: dog.dam.regNumber,
          }
        : null,
      visibleCategories,
      healthSummary: health,
      showSummary: {
        label: isChampion
          ? "Champion"
          : pointCount > 0
            ? "Pointed"
            : dog.showEntries.length > 0
              ? "Shown"
              : "Unshown",
        showEntryCount: dog.showEntries.length,
        pointCount,
        majorCount: dog.titleProgress?.majorCount ?? 0,
        isChampion: Boolean(isChampion),
        isPointed: pointCount > 0,
        isShowEligible,
      },
      breedingSummary: {
        label: isPregnant
          ? "Pregnant"
          : isCoolingDown
            ? "Cooldown"
            : isBreedingEligible
              ? "Breeding eligible"
              : "Not breeding eligible",
        canBreed: isBreedingEligible,
        alreadyBred: dog.dammedLitters.length > 0 || dog.siredLitters.length > 0,
        pregnant: isPregnant,
        cooldown: isCoolingDown,
        recentLitter,
        championOffspringCount: dog.championOffspringCount,
      },
      marketSummary: {
        label: [
          isListedForSale ? "For sale" : null,
          isListedAtStud ? "At stud" : null,
        ]
          .filter(Boolean)
          .join(" / ") || "Private kennel dog",
        marketState: dog.marketState,
        isListedForSale,
        isListedAtStud,
      },
      goalFitLabel: args.goalKey ? "Neutral / flexible" : "Select a program goal",
      reasonTags: [],
      warningTags: [],
      existingPlannerTag: dog.plannerTags[0]
        ? {
            id: dog.plannerTags[0].id,
            tagType: dog.plannerTags[0].tagType as ProgramPlannerTagType,
            goalKey: dog.plannerTags[0].goalKey,
            note: dog.plannerTags[0].note,
            isVisibleOnDogPage: dog.plannerTags[0].isVisibleOnDogPage,
            updatedAt: dog.plannerTags[0].updatedAt.toISOString(),
          }
        : null,
    };
  });

  const context = buildDogContext(baseDogs);
  const adultMaleCount = baseDogs.filter(
    (dog) => dog.sex === "M" && dog.ageClass === "Adult"
  ).length;
  const adultFemaleCount = baseDogs.filter(
    (dog) => dog.sex === "F" && dog.ageClass === "Adult"
  ).length;

  const dogs = baseDogs.map((dog) => ({
    ...dog,
    ...goalFitForDog({
      dog,
      goalKey: args.goalKey ?? null,
      similarCount: context.similarCounts.get(dog.dogId) ?? 0,
      closeProfileCount: context.closeProfileCounts.get(dog.dogId) ?? 0,
      adultMaleCount,
      adultFemaleCount,
    }),
  }));

  const selectedBreed = selectedBreedCode2
    ? availableBreeds.find((breed) => breed.breedCode2 === selectedBreedCode2) ??
      null
    : null;

  const averageProfile = Object.fromEntries(
    ALL_CATEGORY_KEYS.map((key) => [
      key,
      Number(average(dogs.map((dog) => dog.visibleCategories[key])).toFixed(1)),
    ])
  ) as VisibleCategories;

  const categorySpread = ALL_CATEGORY_KEYS.map((key) => {
    const values = dogs.map((dog) => dog.visibleCategories[key]);
    const avg = average(values);
    const under = values.filter((value) => directionForValue(value) === "under")
      .length;
    const near = values.filter((value) => directionForValue(value) === "near")
      .length;
    const over = values.filter((value) => directionForValue(value) === "over")
      .length;

    return {
      key,
      label: CATEGORY_LABELS[key],
      average: Number(avg.toFixed(1)),
      direction: directionLabel(avg),
      under,
      near,
      over,
      spread:
        values.length > 0
          ? Number((Math.max(...values) - Math.min(...values)).toFixed(1))
          : 0,
    };
  });

  const snapshot = selectedBreed
    ? {
        totalDogs: dogs.length,
        males: dogs.filter((dog) => dog.sex === "M").length,
        females: dogs.filter((dog) => dog.sex === "F").length,
        puppies: dogs.filter((dog) => dog.ageClass === "Puppy").length,
        juniors: dogs.filter((dog) => dog.ageClass === "Junior").length,
        adults: dogs.filter((dog) => dog.ageClass === "Adult").length,
        veterans: dogs.filter((dog) => dog.ageClass === "Veteran").length,
        champions: dogs.filter((dog) => dog.showSummary.isChampion).length,
        pointed: dogs.filter(
          (dog) => dog.showSummary.isPointed && !dog.showSummary.isChampion
        ).length,
        unshown: dogs.filter((dog) => dog.showSummary.showEntryCount === 0)
          .length,
        healthComplete: dogs.filter(
          (dog) => dog.healthSummary.status === "complete"
        ).length,
        healthIncomplete: dogs.filter(
          (dog) => dog.healthSummary.status === "eligible_incomplete"
        ).length,
        healthConcern: dogs.filter((dog) => dog.healthSummary.status === "concern")
          .length,
        healthTooYoung: dogs.filter(
          (dog) => dog.healthSummary.status === "too_young"
        ).length,
        breedingAgeDogs: dogs.filter((dog) => dog.breedingSummary.canBreed)
          .length,
        showEligibleDogs: dogs.filter((dog) => dog.showSummary.isShowEligible)
          .length,
        forSaleDogs: dogs.filter((dog) => dog.marketSummary.isListedForSale)
          .length,
        atStudDogs: dogs.filter((dog) => dog.marketSummary.isListedAtStud)
          .length,
        recentlyBredOrWhelped: dogs.filter(
          (dog) => dog.breedingSummary.pregnant || dog.breedingSummary.recentLitter
        ).length,
        averageProfile,
        categorySpread,
      }
    : null;

  return {
    availableBreeds,
    selectedBreed,
    selectedGoalKey: args.goalKey ?? null,
    availableGoals: PROGRAM_PLANNER_GOALS,
    categoryLabels: CATEGORY_LABELS,
    snapshot,
    patternSummary: selectedBreed
      ? patternSummary({
          dogs,
          breedName: selectedBreed.breedName,
          goalKey: args.goalKey ?? null,
        })
      : [],
    filterCounts: filterCountMetadata(dogs),
    finalWarnings: finalWarnings(dogs),
    dogs,
  };
}

export function parsePlannerTagType(value: unknown): ProgramPlannerTagType | null {
  return typeof value === "string" && TAG_TYPES.has(value as ProgramPlannerTagType)
    ? (value as ProgramPlannerTagType)
    : null;
}

export async function saveProgramPlannerTags(args: {
  kennelId: string;
  breedCode2: string;
  goalKey: string;
  tags: Array<{
    dogId: string;
    tagType: ProgramPlannerTagType;
    note: string;
    isVisibleOnDogPage: boolean;
  }>;
}) {
  const dogIds = [...new Set(args.tags.map((tag) => tag.dogId))];
  const dogs = await db.dog.findMany({
    where: {
      id: {
        in: dogIds,
      },
      ownerKennelId: args.kennelId,
      breedCode2: args.breedCode2,
      lifecycleState: "ALIVE",
      isPlayerVisible: true,
    },
    select: {
      id: true,
    },
  });
  const ownedDogIds = new Set(dogs.map((dog) => dog.id));

  if (ownedDogIds.size !== dogIds.length) {
    throw new Error("One or more planner tags refer to dogs you do not own.");
  }

  await db.$transaction(
    args.tags.map((tag) =>
      db.dogPlannerTag.upsert({
        where: {
          kennelId_dogId_source: {
            kennelId: args.kennelId,
            dogId: tag.dogId,
            source: "PROGRAM_PLANNER",
          },
        },
        create: {
          kennelId: args.kennelId,
          dogId: tag.dogId,
          tagType: tag.tagType as DogPlannerTagType,
          source: "PROGRAM_PLANNER",
          breedCode2: args.breedCode2,
          goalKey: args.goalKey,
          note: tag.note || null,
          isVisibleOnDogPage: tag.isVisibleOnDogPage,
        },
        update: {
          tagType: tag.tagType as DogPlannerTagType,
          breedCode2: args.breedCode2,
          goalKey: args.goalKey,
          note: tag.note || null,
          isVisibleOnDogPage: tag.isVisibleOnDogPage,
        },
      })
    )
  );

  return { savedCount: args.tags.length };
}
