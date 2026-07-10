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

function sectionBetween(
  haystack: string,
  startMarker: string,
  endMarker: string,
  label: string
): string {
  const startIndex = haystack.indexOf(startMarker);
  assert.ok(startIndex >= 0, `${label}: missing start marker`);

  const endIndex = haystack.indexOf(endMarker, startIndex + startMarker.length);
  assert.ok(endIndex >= 0, `${label}: missing end marker`);

  return haystack.slice(startIndex, endIndex);
}

const healthConstants = source("packages/rules/constants/health.constants.ts");
const healthExpression = source(
  "packages/rules/engines/healthExpression.engine.ts"
);
const presentationEngine = source("packages/rules/engines/presentation.engine.ts");
const prismaSchema = source("apps/web/prisma/schema.prisma");
const healthService = source("apps/web/server/services/healthTest.service.ts");
const dogService = source("apps/web/server/services/dog.service.ts");
const dogVisibleCategoriesService = source(
  "apps/web/server/services/dogVisibleCategories.service.ts"
);
const litterService = source("apps/web/server/services/litter.service.ts");
const litterMapper = source("apps/web/server/mappers/litter.mapper.ts");
const mineDogsRoute = source("apps/web/app/api/dogs/mine/route.ts");
const marketService = source("apps/web/server/services/market.service.ts");
const studsPage = source("apps/web/app/studs/page.tsx");
const breedingPlannerPage = source(
  "apps/web/components/breeding/BreedingPlannerPage.tsx"
);
const programPlannerService = source(
  "apps/web/server/services/programPlanner.service.ts"
);
const groomingService = source("apps/web/server/services/grooming.service.ts");
const groomingDecayJobRoute = source(
  "apps/web/app/api/jobs/apply-grooming-decay/route.ts"
);
const groomingDecayWorkflow = source(".github/workflows/grooming-decay.yml");
const lifecycleService = source("apps/web/server/services/lifecycle.service.ts");
const judgingService = source("apps/web/server/services/judging.service.ts");
const dogMapper = source("apps/web/server/mappers/dog.mapper.ts");
const dogProfileDashboard = source(
  "apps/web/components/dogs/DogProfileDashboard.tsx"
);
const brucellosisScreeningRoute = source(
  "apps/web/app/api/dogs/[dogId]/brucellosis-screening/route.ts"
);
const healthTestingPanel = source(
  "apps/web/components/dogs/HealthTestingPanel.tsx"
);
const healthClearBadge = source("apps/web/components/dogs/HealthClearBadge.tsx");
const offerDogAtStudForm = source(
  "apps/web/components/dogs/OfferDogAtStudForm.tsx"
);
const faqPage = source("apps/web/app/faq/page.tsx");
const foundationDogService = source(
  "apps/web/server/services/foundationDog.service.ts"
);
const breedingService = source("apps/web/server/services/breeding.service.ts");
const dogHealth = source("apps/web/lib/dogHealth.ts");
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
const phenotypeHealthTestCodeBlock =
  healthConstants.match(
    /PHENOTYPE_HEALTH_TEST_CODES = \[[\s\S]*?\] as const/
  )?.[0] ?? "";
const allBreedRequiredHealthTestCodeBlock =
  healthConstants.match(
    /ALL_BREED_REQUIRED_HEALTH_TEST_CODES = \[[\s\S]*?\] as const/
  )?.[0] ?? "";
const thyroidHealthTestDefinitionBlock = sectionBetween(
  healthConstants,
  "THYROID: {",
  "minimumAgeHours: 365",
  "thyroid health test definition"
);

assertIncludes(
  healthConstants,
  '"ELBOW_DYSPLASIA"',
  "elbow dysplasia is in the supported phenotype health test list"
);
assertIncludes(
  healthConstants,
  'BRUCELLOSIS_TEST_FEE = 75',
  "brucellosis screening fee remains the shared $75 constant"
);
assertIncludes(
  thyroidHealthTestDefinitionBlock,
  "fee: 300",
  "thyroid screening fee remains the shared $300 health test catalog value"
);
assertIncludes(
  dogService,
  "cost: definition.fee",
  "dog profile health test rows expose the shared health test fee"
);
assertIncludes(
  healthTestingPanel,
  "{formatMoney(row.fee)}",
  "dog profile health test panel displays the row fee from the shared catalog"
);
assertIncludes(
  healthService,
  "(sum, testTypeCode) => sum + PHENOTYPE_HEALTH_TESTS[testTypeCode].fee",
  "health test checkout totals are driven by the shared health test fee"
);
assertIncludes(
  healthService,
  "amount: -definition.fee",
  "health test ledger charges are driven by the shared health test fee"
);
assertDoesNotIncludeAny(
  healthService,
  ["amount: -175", "amount: -300"],
  "health test purchase charges must not hard-code thyroid or other test fees"
);
assertDoesNotIncludeAny(
  healthTestingPanel,
  ["$175", "$300"],
  "health test panel must not hard-code displayed test fees"
);
assertDoesNotIncludeAny(
  phenotypeHealthTestCodeBlock,
  ["BRUCELLOSIS"],
  "brucellosis is not part of the core phenotype health test catalog"
);
assertDoesNotIncludeAny(
  allBreedRequiredHealthTestCodeBlock,
  ["BRUCELLOSIS"],
  "brucellosis is not part of all-breed required health tests"
);
assertIncludes(
  healthConstants,
  "ALL_BREED_REQUIRED_HEALTH_TEST_CODES",
  "rules layer has a separate all-breed required health test list"
);
assertIncludes(
  healthConstants,
  "BREED_SPECIFIC_REQUIRED_HEALTH_TEST_CODES",
  "rules layer has a placeholder for future breed-specific required health tests"
);
assertIncludes(
  healthConstants,
  "getRequiredHealthTestsForBreed",
  "rules layer exposes required health tests by breed"
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
  dogVisibleCategoriesService,
  "deriveHealthAdjustedExpressedTraits",
  "shared dog visible category display helper uses health-adjusted expressed traits"
);
assertBefore(
  dogVisibleCategoriesService,
  "const expressedTraits = deriveHealthAdjustedExpressedTraits({",
  "...deriveVisibleCategoriesFromTraits(expressedTraits)",
  "shared dog visible category display helper derives visible categories from expressed traits"
);
assertIncludes(
  dogVisibleCategoriesService,
  "DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES",
  "shared dog visible category display helper centralizes display health expression condition codes"
);
assertIncludes(
  dogService,
  "deriveCurrentVisibleCategoriesForDogDisplay({",
  "dog profile service uses the shared current visible category display helper"
);
assertIncludes(
  dogService,
  "in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES]",
  "dog profile service selects hidden hip, elbow, and CAER truths for visible category expression"
);
assertIncludes(
  dogService,
  "phenotypeHealthTruths: healthConditionTruths",
  "dog profile visible category expression uses freshly refetched hidden health truths"
);
assertIncludes(
  dogService,
  "phenotypeHealthResults: dog.healthTests",
  "dog profile visible category expression can fall back to revealed health results"
);

const breedJudgingSection = sectionBetween(
  judgingService,
  "export async function judgeShowBlock",
  "export async function judgeShowDay",
  "breed judging section"
);
const groupJudgingSection = sectionBetween(
  judgingService,
  "async function createGroupAwardsForShowDay",
  "async function createBestInShowAwardsForShowDay",
  "group judging section"
);
const bestInShowJudgingSection = sectionBetween(
  judgingService,
  "async function createBestInShowAwardsForShowDay",
  "export async function publishReadyShowDayResults",
  "Best in Show judging section"
);

for (const [label, helperName] of [
  ["breed judging", "ensureAndLoadBreedJudgingHealthTruths"],
  ["group judging", "ensureAndLoadGroupJudgingHealthTruths"],
  ["Best in Show judging", "ensureAndLoadBestInShowJudgingHealthTruths"],
] as const) {
  const helperSection = sectionBetween(
    judgingService,
    `async function ${helperName}`,
    "function awardsChampionshipPoints",
    `${label} health truth helper`
  );

  assertBefore(
    helperSection,
    "await ensurePhenotypeHealthTruthsForDogs(tx, uniqueDogIds);",
    "const healthConditionTruths = await tx.dogHealthConditionTruth.findMany({",
    `${label} ensures hidden health truths before refetching them`
  );
  assertIncludes(
    helperSection,
    "dogId: true",
    `${label} refetches hidden health truths keyed by dog ID`
  );
  assertIncludes(
    helperSection,
    "conditionCode: true",
    `${label} refetches hidden health truth condition codes server-side`
  );
}

assertBefore(
  breedJudgingSection,
  "const healthTruthsByDogId = await ensureAndLoadBreedJudgingHealthTruths(",
  "const judgedBlock = judgeBreedBlock({",
  "breed judging ensures/refetches hidden health truths before breed scoring"
);
assertBefore(
  groupJudgingSection,
  "const healthTruthsByDogId = await ensureAndLoadGroupJudgingHealthTruths(",
  "const judgedGroupAwards = judgeGroup({",
  "group judging ensures/refetches hidden health truths before group scoring"
);
assertBefore(
  bestInShowJudgingSection,
  "await ensureAndLoadBestInShowJudgingHealthTruths(",
  "const judgedBestInShowAwards = judgeBestInShow({",
  "Best in Show judging ensures/refetches hidden health truths before BIS scoring"
);
assertIncludes(
  breedJudgingSection,
  "dog: toEngineDog(entry, healthTruthsByDogId.get(entry.dogId))",
  "breed judging passes fresh hidden health truths into engine scoring"
);
assertIncludes(
  groupJudgingSection,
  "healthTruthsByDogId.get(award.dogId)",
  "group judging passes fresh hidden health truths into engine scoring"
);
assertIncludes(
  bestInShowJudgingSection,
  "healthTruthsByDogId.get(award.dogId)",
  "Best in Show judging passes fresh hidden health truths into engine scoring"
);
assertDoesNotIncludeAny(
  sectionBetween(
    judgingService,
    "export type JudgedShowResultDto",
    "export type JudgeShowBlockDto",
    "judged show result DTO"
  ),
  ["healthConditionTruths", "geneticLiability", "environmentModifier"],
  "show result DTO should not expose hidden health truth values"
);
for (const [label, fileSource] of [
  ["litter mapper", litterMapper],
  ["kennel dog list route", mineDogsRoute],
  ["market listing service", marketService],
  ["stud listing page", studsPage],
  ["breeding planner page", breedingPlannerPage],
  ["program planner service", programPlannerService],
] as const) {
  assertIncludes(
    fileSource,
    "deriveCurrentVisibleCategoriesForDogDisplay",
    `${label} uses the shared current visible category display helper`
  );
  assertDoesNotIncludeAny(
    fileSource,
    ["visibleCategories: deriveVisibleCategoriesFromTraits"],
    `${label} should not derive displayed visible categories directly from raw stored traits`
  );
}
for (const [label, fileSource] of [
  ["litter service", litterService],
  ["kennel dog list route", mineDogsRoute],
  ["market listing service", marketService],
  ["stud listing page", studsPage],
  ["breeding planner page", breedingPlannerPage],
  ["program planner service", programPlannerService],
] as const) {
  assertIncludes(
    fileSource,
    "in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES]",
    `${label} loads only display-relevant hidden health truths server-side`
  );
}
assertIncludes(
  foundationDogService,
  "deriveCurrentVisibleCategoriesForDogDisplay",
  "foundation market display uses the shared current visible category display helper"
);
assertDoesNotIncludeAny(
  foundationDogService,
  ["visibleCategories: deriveVisibleCategoriesFromTraits"],
  "foundation market display should not derive visible categories directly from raw stored traits"
);
assertIncludes(
  dogService,
  "PHENOTYPE_HEALTH_TEST_CODES.map((testCode)",
  "dog profile health testing UI rows are driven by the supported test list"
);
assertIncludes(
  dogService,
  "getRequiredHealthTestsForBreed(dog.breedCode2)",
  "dog profile aggregate health summary uses required health tests"
);
assertIncludes(
  dogHealth,
  "hasAllGreenRequiredPhenotypeHealthTests",
  "web health helpers separate required-test clearance from supported-test catalog"
);
assertIncludes(
  dogHealth,
  "hasCompletedRequiredPhenotypeHealthTests",
  "web health helpers expose required-test completion checks"
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
  "DEFAULT_MISSED_GROOMING_DECAY_BATCH_SIZE = 400",
  "grooming decay service defaults to the requested 400-candidate batch"
);
assertIncludes(
  groomingService,
  "MAX_MISSED_GROOMING_DECAY_BATCH_SIZE = 400",
  "grooming decay keeps the service batch limit bounded"
);
assertIncludes(
  groomingDecayJobRoute,
  "export const maxDuration = 300",
  "grooming decay job route declares an intentional max duration"
);
assertIncludes(
  groomingDecayJobRoute,
  "const DEFAULT_DECAY_BATCH_SIZE = 400",
  "grooming decay job route defaults to the requested 400-candidate batch"
);
assertIncludes(
  groomingDecayJobRoute,
  "const MAX_DECAY_BATCH_SIZE = 400",
  "grooming decay job route caps requested batches at 400"
);
assertIncludes(
  groomingDecayWorkflow,
  '${SHOWRING_JOBS_BASE_URL%/}/api/jobs/apply-grooming-decay"',
  "scheduled grooming decay workflow uses the default job batch size"
);
assertDoesNotIncludeAny(
  groomingDecayWorkflow,
  ["apply-grooming-decay?limit=", "limit=500"],
  "scheduled grooming decay workflow does not request an oversized batch"
);
assertIncludes(
  groomingService,
  "let groomingWeek = firstEligibleGroomingWeek",
  "grooming decay scans missed weeks from first eligible week"
);
assertIncludes(
  groomingService,
  "groomingWeek <= args.latestCompletedGroomingWeek",
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
assertIncludes(
  groomingService,
  "earliestPendingWeek",
  "grooming decay response reports the earliest pending backlog week"
);
assertIncludes(
  groomingService,
  "latestPendingWeek",
  "grooming decay response reports the latest pending backlog week"
);
assertIncludes(
  groomingService,
  "pendingCandidateCount",
  "grooming decay response reports the pending backlog candidate count"
);
assertIncludes(
  groomingService,
  "caughtUp: !hasMore",
  "grooming decay response reports caught-up state from remaining backlog"
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
assertIncludes(
  dogService,
  "in: [...DISPLAY_HEALTH_EXPRESSION_CONDITION_CODES]",
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
  brucellosisScreeningRoute,
  "runBrucellosisTest",
  "standalone dog brucellosis route reuses the infectious disease test service"
);
assertDoesNotIncludeAny(
  brucellosisScreeningRoute,
  ["healthTestRecord", "HealthTestRecord"],
  "standalone dog brucellosis route does not create core health test records"
);
assertIncludes(
  dogProfileDashboard,
  "Run Brucellosis Screening",
  "dog profile breeding safety card can run brucellosis screening"
);
assertIncludes(
  dogProfileDashboard,
  "Repeat Screening",
  "dog profile breeding safety card can repeat current brucellosis screening"
);
assertIncludes(
  dogProfileDashboard,
  "BRUCELLOSIS_TEST_FEE",
  "dog profile breeding safety card shows the shared brucellosis screening cost"
);
assertIncludes(
  dogProfileDashboard,
  "formatBreedingSafetyCost",
  "dog profile breeding safety card formats the $75 brucellosis screening cost"
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
  breedingService,
  "sireTraits: mapTraits(fresh.sire)",
  "breeding inheritance still uses stored sire genetic traits"
);
assertIncludes(
  breedingService,
  "damTraits: mapTraits(fresh.dam)",
  "breeding inheritance still uses stored dam genetic traits"
);
assertIncludes(
  breedingService,
  "hasCompletedRequiredPhenotypeHealthTests(dam.healthTests, dam.breedCode2)",
  "server-side stud eligibility uses required-test completion and includes elbows"
);
assertIncludes(
  breedingService,
  "hasAllGreenRequiredPhenotypeHealthTests(dam.healthTests, dam.breedCode2)",
  "server-side stud green requirement uses required-test clearance"
);
assertDoesNotIncludeAny(
  `${healthClearBadge}\n${offerDogAtStudForm}\n${breedingService}\n${faqPage}`,
  ["all " + "four", "All " + "four", "all " + "five", "All " + "five"],
  "player-facing health requirement copy should avoid hardcoded test counts"
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
