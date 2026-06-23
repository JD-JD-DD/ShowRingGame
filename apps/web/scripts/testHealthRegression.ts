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
const healthService = source("apps/web/server/services/healthTest.service.ts");
const dogService = source("apps/web/server/services/dog.service.ts");
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
  'conditionCode: "HIP_DYSPLASIA"',
  "dog profile service selects hidden hip truth for visible category expression"
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
  "function getHipDysplasiaImpactStatement",
  "dog profile service has a scoped hip impact statement helper"
);
assertIncludes(
  dogService,
  'args.testCode !== "HIP_DYSPLASIA"',
  "health impact statements are scoped to hip dysplasia"
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
  "healthImpactStatement: severityKey",
  "dog profile health impact statement requires a completed public result severity"
);
assertBefore(
  dogService,
  "const expressedTraits = deriveHealthAdjustedExpressedTraits({",
  "...deriveVisibleCategoriesFromTraits(expressedTraits)",
  "dog profile derives visible categories from expressed traits"
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
