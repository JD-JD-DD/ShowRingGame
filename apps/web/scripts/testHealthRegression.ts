import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function assertIncludes(haystack: string, needle: string, label: string): void {
  assert.ok(haystack.includes(needle), label);
}

function assertBefore(
  haystack: string,
  first: string,
  second: string,
  label: string
): void {
  const firstIndex = haystack.indexOf(first);
  const secondIndex = haystack.indexOf(second);

  assert.ok(firstIndex >= 0, `${label}: missing first marker`);
  assert.ok(secondIndex >= 0, `${label}: missing second marker`);
  assert.ok(firstIndex < secondIndex, label);
}

function assertDoesNotIncludeAny(
  haystack: string,
  needles: string[],
  label: string
): void {
  const found = needles.filter((needle) => haystack.includes(needle));

  assert.deepEqual(found, [], label);
}

const healthConstants = source("packages/rules/constants/health.constants.ts");
const healthExpression = source(
  "packages/rules/engines/healthExpression.engine.ts"
);
const presentationEngine = source("packages/rules/engines/presentation.engine.ts");
const prismaSchema = source("apps/web/prisma/schema.prisma");
const healthService = source("apps/web/server/services/healthTest.service.ts");
const dogService = source("apps/web/server/services/dog.service.ts");
const groomingService = source("apps/web/server/services/grooming.service.ts");
const lifecycleService = source("apps/web/server/services/lifecycle.service.ts");
const dogMapper = source("apps/web/server/mappers/dog.mapper.ts");
const dogProfileDashboard = source(
  "apps/web/components/dogs/DogProfileDashboard.tsx"
);
const healthTestingPanel = source(
  "apps/web/components/dogs/HealthTestingPanel.tsx"
);
const foundationDogService = source(
  "apps/web/server/services/foundationDog.service.ts"
);
const breedingService = source("apps/web/server/services/breeding.service.ts");
const healthBackfill = source("apps/web/scripts/backfill-phenotype-health.ts");

const rawTraitFields = [
  "traitHead",
  "traitForequarters",
  "traitHindquarters",
  "traitGait",
  "traitCoat",
  "traitSize",
  "traitTemperament",
  "traitShowShine",
  "traitFeet",
  "traitTopline",
];

assertIncludes(
  healthConstants,
  '"ELBOW_DYSPLASIA"',
  "elbow dysplasia is in the supported phenotype health test list"
);
assertIncludes(
  healthConstants,
  "ELBOW_DYSPLASIA: {",
  "elbow dysplasia has a health test definition"
);
assertIncludes(
  healthConstants,
  'label: "Elbow Dysplasia"',
  "elbow dysplasia has display label support"
);
assertIncludes(
  healthConstants,
  'minimumAgeLabel: "Available at 24 months"',
  "elbow dysplasia uses orthopedic adult age copy"
);
assertIncludes(
  healthConstants,
  "GRADE_3: \"red\"",
  "elbow dysplasia has red result severity support"
);
assertIncludes(
  healthService,
  "type HealthClient = Pick<",
  "health test service uses a constrained health client"
);
assertIncludes(
  healthService,
  '"dogHealthConditionTruth"',
  "hidden health truths are part of health test persistence"
);
assertIncludes(
  healthService,
  '"healthTestRecord"',
  "revealed health records are part of health test persistence"
);
assertIncludes(
  healthService,
  "await ensurePhenotypeHealthTruthsForDogs(tx, [dog.id]);",
  "health testing creates missing hidden truths for legacy dogs before reveal"
);
assertBefore(
  healthService,
  "await ensurePhenotypeHealthTruthsForDogs(tx, [dog.id]);",
  "revealPhenotypeHealthTestResult({",
  "health testing reveals from stored/ensured truth instead of revealing first"
);
assertBefore(
  healthService,
  "revealPhenotypeHealthTestResult({",
  "await tx.healthTestRecord.create({",
  "health testing stores public records after revealing from truth"
);
assertIncludes(
  healthService,
  "await client.dogHealthConditionTruth.createMany({",
  "missing hidden truth rows are created through DogHealthConditionTruth"
);
assertIncludes(
  healthService,
  "skipDuplicates: true",
  "hidden truth creation is idempotent for existing truths"
);
assertIncludes(
  healthService,
  "dogAgeHours < PHENOTYPE_HEALTH_TESTS[testTypeCode].minimumAgeHours",
  "health testing age eligibility is driven by the shared test catalog"
);
assertDoesNotIncludeAny(
  healthService,
  rawTraitFields,
  "health testing service should not read or write stored genetic trait fields"
);

assertDoesNotIncludeAny(
  dogMapper,
  rawTraitFields,
  "public dog profile DTO mapper should not expose raw hidden trait fields"
);
assertDoesNotIncludeAny(
  dogMapper,
  ["healthConditionTruths", "geneticLiability", "environmentModifier"],
  "public dog profile DTO mapper should not expose hidden health truth values"
);
assertIncludes(
  dogService,
  "deriveHealthAdjustedExpressedTraits",
  "dog profile service uses health-adjusted expressed traits for visible categories"
);
assertIncludes(
  dogService,
  'in: ["HIP_DYSPLASIA", "ELBOW_DYSPLASIA", "CAER_EYE"]',
  "dog profile service selects hidden hip, elbow, and CAER truths for visible category expression"
);
assertIncludes(
  dogService,
  "phenotypeHealthTruths: dog.healthConditionTruths",
  "dog profile visible category expression uses hidden health truth when available"
);
assertIncludes(
  dogService,
  "phenotypeHealthResults: dog.healthTests",
  "dog profile visible category expression can fall back to revealed health results"
);
assertIncludes(
  dogService,
  "PHENOTYPE_HEALTH_TEST_CODES.map((testCode)",
  "dog profile health testing UI rows are driven by the supported test list"
);
assertIncludes(
  dogService,
  "function getHealthImpactStatement",
  "dog profile service has a scoped orthopedic health impact statement helper"
);
assertIncludes(
  dogService,
  'args.testCode === "HIP_DYSPLASIA"',
  "health impact statements include scoped hip dysplasia copy"
);
assertIncludes(
  dogService,
  'args.testCode === "ELBOW_DYSPLASIA"',
  "health impact statements include scoped elbow dysplasia copy"
);
assertIncludes(
  dogService,
  'args.testCode === "THYROID"',
  "health impact statements include scoped thyroid copy"
);
assertIncludes(
  dogService,
  'args.testCode === "CARDIAC"',
  "health impact statements include scoped cardiac copy"
);
assertIncludes(
  dogService,
  'args.testCode === "CAER_EYE"',
  "health impact statements include scoped CAER copy"
);
assertIncludes(
  dogService,
  "Hip result is mildly affecting rear movement and structure.",
  "yellow hip dysplasia result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "Red hips are limiting rear movement and affecting this dog’s Movement and Structure & Balance.",
  "red hip dysplasia result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "Elbow result is mildly affecting front assembly and movement.",
  "yellow elbow dysplasia result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "Red elbows are limiting front assembly and affecting this dog’s Movement and Structure & Balance.",
  "red elbow dysplasia result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "Thyroid result is reducing coat improvement from grooming.",
  "yellow thyroid result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "Red thyroid is severely limiting coat condition improvement. Grooming has reduced effect on this dog.",
  "red thyroid result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "Cardiac result may modestly affect this dog’s expected longevity.",
  "yellow cardiac result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "Red cardiac result may significantly shorten this dog’s expected lifespan.",
  "red cardiac result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "CAER result is mildly affecting this dog’s ring confidence.",
  "yellow CAER result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "Red CAER result is affecting this dog’s visual comfort, expression, and ring confidence.",
  "red CAER result has the expected player-facing impact statement"
);
assertIncludes(
  dogService,
  "healthImpactStatement: severityKey",
  "dog profile health impact statement requires a completed public result severity"
);
assertIncludes(
  healthExpression,
  '"ELBOW_DYSPLASIA"',
  "health expression supports elbow dysplasia through the shared expressed-trait helper"
);
assertIncludes(
  healthExpression,
  "expressedTraits.forequarters = pushFartherFromIdeal(",
  "elbow dysplasia modifies copied expressed forequarters"
);
assertIncludes(
  healthExpression,
  '"CAER_EYE"',
  "health expression supports CAER through the shared expressed-trait helper"
);
assertIncludes(
  healthExpression,
  "expressedTraits.temperament = pushFartherFromIdeal(",
  "CAER modifies copied expressed temperament"
);
assertDoesNotIncludeAny(
  healthExpression,
  ["expressedTraits.show_shine = pushFartherFromIdeal("],
  "CAER does not modify show shine because it also feeds Coat & Presentation"
);
assertIncludes(
  healthExpression,
  "deriveThyroidGroomingModifiers",
  "health expression provides thyroid grooming modifiers"
);
assertIncludes(
  healthExpression,
  "groomingGainMultiplier: 0.6",
  "yellow thyroid reduces grooming gain"
);
assertIncludes(
  healthExpression,
  "missedGroomingDecayMultiplier: 1.75",
  "red thyroid increases missed grooming decay"
);
assertIncludes(
  healthExpression,
  "coatConditionCap: 9",
  "red thyroid caps coat condition"
);
assertIncludes(
  healthExpression,
  "deriveCardiacLongevityModifiers",
  "health expression provides cardiac longevity modifiers"
);
assertIncludes(
  healthExpression,
  "ageRelatedDeathRiskMultiplier: 1.5",
  "red cardiac has the strongest age-related risk multiplier"
);
assertIncludes(
  healthExpression,
  "ageDeathMultiplier: 0.85",
  "red cardiac shortens projected age longevity without instant death"
);
assertIncludes(
  groomingService,
  "deriveThyroidGroomingModifiers",
  "grooming service uses thyroid grooming modifiers"
);
assertIncludes(
  groomingService,
  "BASE_COAT_CONDITION_GAIN * thyroidModifiers.groomingGainMultiplier",
  "thyroid modifies grooming gain"
);
assertIncludes(
  groomingService,
  "MISSED_GROOMING_DECAY * thyroidModifiers.missedGroomingDecayMultiplier",
  "thyroid modifies missed grooming decay"
);
assertIncludes(
  groomingService,
  "thyroidModifiers.coatConditionCap",
  "thyroid enforces coat condition cap after grooming"
);
assertIncludes(
  groomingService,
  'conditionCode: "THYROID"',
  "grooming service reads hidden thyroid truth server-side"
);
assertIncludes(
  groomingService,
  "latestCompletedGroomingWeek = currentGroomingWeek - 1",
  "grooming decay only targets completed grooming weeks"
);
assertIncludes(
  groomingService,
  "latestCompletedGroomingWeek < 0",
  "grooming decay skips when there are no completed weeks"
);
assertIncludes(
  groomingService,
  "Math.min(Math.max(args.limit ?? 100, 1), 500)",
  "grooming decay keeps the service batch limit bounded"
);
assertIncludes(
  groomingService,
  "let groomingWeek = firstEligibleGroomingWeek",
  "grooming decay scans missed weeks from first eligible week"
);
assertIncludes(
  groomingService,
  "groomingWeek <= latestCompletedGroomingWeek",
  "grooming decay catches up through the latest completed week"
);
assertIncludes(
  groomingService,
  "groomedWeeks.has(groomingWeek) || decayedWeeks.has(groomingWeek)",
  "grooming decay skips already-groomed and already-decayed weeks"
);
assertIncludes(
  groomingService,
  "getMissedGroomingDecayKey(",
  "grooming decay uses a stable dog/week idempotency key"
);
assertIncludes(
  prismaSchema,
  "decayKey            String?               @unique",
  "grooming decay uniqueness is enforced by schema"
);
assertIncludes(
  groomingService,
  "netGroomingImpact <= 0",
  "grooming decay skips dogs without positive net grooming impact"
);
assertDoesNotIncludeAny(
  presentationEngine,
  ["HEALTH_THYROID", "THYROID_HEALTH_MULTIPLIERS", "CAER_EYE"],
  "thyroid and CAER should not remain as direct presentation modifiers"
);
assertIncludes(
  lifecycleService,
  "deriveCardiacLongevityModifiers",
  "lifecycle service uses cardiac longevity modifiers"
);
assertIncludes(
  lifecycleService,
  'conditionCode: "CARDIAC"',
  "lifecycle service reads hidden cardiac truth server-side"
);
assertIncludes(
  lifecycleService,
  'testTypeCode: "CARDIAC"',
  "lifecycle service can fall back to revealed cardiac records"
);
assertIncludes(
  lifecycleService,
  "getBaseProjectedDogDeathEpoch(dog)",
  "accident and illness projection keeps the base age-death window"
);
assertIncludes(
  lifecycleService,
  "cardiacModifiers.ageDeathMultiplier",
  "cardiac modifies only the age-death projection"
);
assertBefore(
  dogService,
  "const expressedTraits = deriveHealthAdjustedExpressedTraits({",
  "...deriveVisibleCategoriesFromTraits(expressedTraits)",
  "dog profile derives visible categories from expressed traits"
);
assertIncludes(
  dogService,
  'in: ["HIP_DYSPLASIA", "ELBOW_DYSPLASIA", "CAER_EYE"]',
  "dog profile service selects hidden CAER truth for visible category expression"
);
assertIncludes(
  dogMapper,
  "healthImpactStatement: test.healthImpactStatement",
  "public dog profile DTO carries the already-filtered health impact statement"
);
assertIncludes(
  dogProfileDashboard,
  "impactStatement: test.healthImpactStatement",
  "dog profile dashboard passes health impact statements into completed health rows"
);
assertIncludes(
  healthTestingPanel,
  "row.result?.impactStatement",
  "health testing panel renders impact statements only inside completed result rows"
);

assertIncludes(
  foundationDogService,
  "await ensurePhenotypeHealthTruthsForDogs(tx, [createdDog.id]);",
  "foundation dogs receive hidden health truths at creation"
);
assertIncludes(
  breedingService,
  "await ensurePhenotypeHealthTruthsForDogs(",
  "puppies receive hidden health truths after whelping"
);
assertIncludes(
  healthBackfill,
  "PHENOTYPE_HEALTH_TEST_CODES.length",
  "health backfill expects one hidden truth per supported phenotype health test"
);
assertIncludes(
  healthBackfill,
  "generateFoundationPhenotypeHealthTruths(random01)",
  "health backfill uses the shared foundation truth generation path"
);
assertIncludes(
  healthBackfill,
  "inheritPhenotypeHealthTruths({",
  "health backfill uses the shared inheritance path for bred dogs"
);

console.log("Web health regression checks passed.");
