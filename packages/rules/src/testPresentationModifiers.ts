import { strict as assert } from "node:assert";
import {
  applyPresentationModifiersToCharacteristics,
  deriveShowCharacteristicsFromTraits,
  scoreDogByJudgeWeights,
  type Dog,
  type DogTraits,
  type Judge,
  type JudgingCategory,
} from "@showring/rules";
import { SHOW_YEAR_HOURS } from "../constants/time.constants";

const SHOW_EPOCH = 10 * SHOW_YEAR_HOURS;

const traits: DogTraits = {
  head: 12,
  forequarters: 12,
  hindquarters: 12,
  gait: 12,
  coat: 12,
  size: 12,
  temperament: 12,
  show_shine: 12,
  feet: 12,
  topline: 12,
};

const underIdealTraits: DogTraits = {
  head: 8,
  forequarters: 8,
  hindquarters: 8,
  gait: 8,
  coat: 8,
  size: 8,
  temperament: 8,
  show_shine: 8,
  feet: 8,
  topline: 8,
};

const idealTraits: DogTraits = {
  head: 10,
  forequarters: 10,
  hindquarters: 10,
  gait: 10,
  coat: 10,
  size: 10,
  temperament: 10,
  show_shine: 10,
  feet: 10,
  topline: 10,
};

const balancedJudge: Judge = {
  judgeId: "judge-test",
  name: "Balanced Judge",
  style: "BALANCED",
  categoryWeights: {
    TYPE_EXPRESSION: 1,
    STRUCTURE_BALANCE: 1,
    MOVEMENT: 1,
    COAT_PRESENTATION: 1,
    TEMPERAMENT_RING_BEHAVIOR: 1,
    CONDITIONING_HANDLING: 1,
  },
};

function makeDog(ageHours: number, dogTraits = traits): Dog {
  return {
    dogId: `dog-${ageHours}`,
    regNumber: `TEST${ageHours}`,
    breedCode2: "TS",
    birthEpoch: SHOW_EPOCH - ageHours,
    sex: "F",
    status: "ALIVE",
    litterId: null,
    litterOrder: null,
    sireId: null,
    damId: null,
    traits: dogTraits,
  };
}

function presentedValue(args: {
  ageHours: number;
  category: JudgingCategory;
  dogTraits?: DogTraits;
  presentation?: Dog["presentation"];
  showEpoch?: number;
}) {
  const dog = {
    ...makeDog(args.ageHours, args.dogTraits ?? traits),
    presentation: args.presentation,
  };
  const base = deriveShowCharacteristicsFromTraits(dog.traits);
  const presented = applyPresentationModifiersToCharacteristics({
    characteristics: base,
    dog,
    showEpoch: args.showEpoch ?? SHOW_EPOCH,
  });

  return presented.details[args.category];
}

function hipPresentation(geneticLiability: number): Dog["presentation"] {
  return {
    phenotypeHealthTruths: [
      {
        conditionCode: "HIP_DYSPLASIA",
        geneticLiability,
        environmentModifier: 0,
      },
    ],
  };
}

function elbowPresentation(geneticLiability: number): Dog["presentation"] {
  return {
    phenotypeHealthTruths: [
      {
        conditionCode: "ELBOW_DYSPLASIA",
        geneticLiability,
        environmentModifier: 0,
      },
    ],
  };
}

function cardiacPresentation(geneticLiability: number): Dog["presentation"] {
  return {
    phenotypeHealthTruths: [
      {
        conditionCode: "CARDIAC",
        geneticLiability,
        environmentModifier: 0,
      },
    ],
  };
}

function caerPresentation(geneticLiability: number): Dog["presentation"] {
  return {
    phenotypeHealthTruths: [
      {
        conditionCode: "CAER_EYE",
        geneticLiability,
        environmentModifier: 0,
      },
    ],
  };
}

function scoredDog(args: {
  dogTraits: DogTraits;
  presentation?: Dog["presentation"];
}) {
  return scoreDogByJudgeWeights({
    dog: {
      ...makeDog(3 * SHOW_YEAR_HOURS, args.dogTraits),
      presentation: args.presentation,
    },
    judge: balancedJudge,
    showEpoch: SHOW_EPOCH,
    random01: () => 0.5,
  });
}

function assertClose(actual: number, expected: number) {
  assert.ok(
    Math.abs(actual - expected) < 0.001,
    `Expected ${actual} to be close to ${expected}`
  );
}

const sixMonthsMovement = presentedValue({
  ageHours: 182,
  category: "MOVEMENT",
});
const eighteenMonthsMovement = presentedValue({
  ageHours: Math.round(1.5 * SHOW_YEAR_HOURS),
  category: "MOVEMENT",
});
const twoYearsMovement = presentedValue({
  ageHours: 2 * SHOW_YEAR_HOURS,
  category: "MOVEMENT",
});
const adultMovement = presentedValue({
  ageHours: 3 * SHOW_YEAR_HOURS,
  category: "MOVEMENT",
});
const fourYearsMovement = presentedValue({
  ageHours: 4 * SHOW_YEAR_HOURS,
  category: "MOVEMENT",
});
const fiveYearsMovement = presentedValue({
  ageHours: 5 * SHOW_YEAR_HOURS,
  category: "MOVEMENT",
});
const nineYearsMovement = presentedValue({
  ageHours: 9 * SHOW_YEAR_HOURS,
  category: "MOVEMENT",
});
const sixMonthsUnderIdealMovement = presentedValue({
  ageHours: 182,
  category: "MOVEMENT",
  dogTraits: underIdealTraits,
});
const nineYearsType = presentedValue({
  ageHours: 9 * SHOW_YEAR_HOURS,
  category: "TYPE_EXPRESSION",
});
const nineYearsTemperament = presentedValue({
  ageHours: 9 * SHOW_YEAR_HOURS,
  category: "TEMPERAMENT_RING_BEHAVIOR",
});
const latePregnancyMovement = presentedValue({
  ageHours: 3 * SHOW_YEAR_HOURS,
  category: "MOVEMENT",
  presentation: {
    dueEpoch: SHOW_EPOCH + 2,
  },
});
const postWhelpCoat = presentedValue({
  ageHours: 3 * SHOW_YEAR_HOURS,
  category: "COAT_PRESENTATION",
  presentation: {
    lastWhelpedEpoch: SHOW_EPOCH - 63,
  },
});
const severeHipMovement = presentedValue({
  ageHours: 3 * SHOW_YEAR_HOURS,
  category: "MOVEMENT",
  presentation: {
    phenotypeHealthTruths: [
      {
        conditionCode: "HIP_DYSPLASIA",
        geneticLiability: 0.9,
        environmentModifier: 0,
      },
    ],
  },
});
const autoimmuneThyroidMovement = presentedValue({
  ageHours: 3 * SHOW_YEAR_HOURS,
  category: "MOVEMENT",
  presentation: {
    phenotypeHealthTruths: [
      {
        conditionCode: "THYROID",
        geneticLiability: 0.8,
        environmentModifier: 0,
      },
    ],
  },
});
const lowHindquartersTraits: DogTraits = {
  ...idealTraits,
  hindquarters: 7.5,
};
const highHindquartersTraits: DogTraits = {
  ...idealTraits,
  hindquarters: 12.5,
};
const lowHindquartersBaseline = scoredDog({
  dogTraits: lowHindquartersTraits,
});
const lowHindquartersYellowHips = scoredDog({
  dogTraits: lowHindquartersTraits,
  presentation: hipPresentation(0.5),
});
const lowHindquartersRedHips = scoredDog({
  dogTraits: lowHindquartersTraits,
  presentation: hipPresentation(0.9),
});
const highHindquartersBaseline = scoredDog({
  dogTraits: highHindquartersTraits,
});
const highHindquartersRedHips = scoredDog({
  dogTraits: highHindquartersTraits,
  presentation: hipPresentation(0.9),
});
const lowForequartersTraits: DogTraits = {
  ...idealTraits,
  forequarters: 7.5,
};
const highForequartersTraits: DogTraits = {
  ...idealTraits,
  forequarters: 12.5,
};
const lowForequartersBaseline = scoredDog({
  dogTraits: lowForequartersTraits,
});
const lowForequartersYellowElbows = scoredDog({
  dogTraits: lowForequartersTraits,
  presentation: elbowPresentation(0.5),
});
const lowForequartersRedElbows = scoredDog({
  dogTraits: lowForequartersTraits,
  presentation: elbowPresentation(0.9),
});
const highForequartersBaseline = scoredDog({
  dogTraits: highForequartersTraits,
});
const highForequartersRedElbows = scoredDog({
  dogTraits: highForequartersTraits,
  presentation: elbowPresentation(0.9),
});
const redCardiacJudging = scoredDog({
  dogTraits: idealTraits,
  presentation: cardiacPresentation(0.9),
});
const redCardiacBaselineJudging = scoredDog({
  dogTraits: idealTraits,
});
const caerTraits: DogTraits = {
  ...idealTraits,
  show_shine: 7.5,
  temperament: 7.5,
};
const redCaerJudging = scoredDog({
  dogTraits: caerTraits,
  presentation: caerPresentation(0.9),
});
const redCaerBaselineJudging = scoredDog({
  dogTraits: caerTraits,
});

assert.ok(
  sixMonthsMovement.presentedValue > eighteenMonthsMovement.presentedValue,
  "A 6-month dog should have a stronger youth modifier than an 18-month dog."
);
assert.ok(
  eighteenMonthsMovement.presentedValue > twoYearsMovement.presentedValue,
  "Youth modifier should fade until age 2."
);
assertClose(twoYearsMovement.presentedValue, 12);
assertClose(fourYearsMovement.presentedValue, 12);
assert.ok(
  fiveYearsMovement.presentedValue > fourYearsMovement.presentedValue,
  "Past-prime modifier should begin after age 4."
);
assert.ok(
  nineYearsMovement.presentedValue > fiveYearsMovement.presentedValue,
  "Past-prime modifier should strengthen over time."
);
assert.ok(
  nineYearsMovement.presentedValue >= 18,
  "A 9-year-old should be heavily pushed away from ideal."
);
assert.ok(
  sixMonthsUnderIdealMovement.presentedValue <
    deriveShowCharacteristicsFromTraits(underIdealTraits).MOVEMENT,
  "Below-ideal values should be pushed lower, not toward ideal."
);
assert.ok(
  nineYearsMovement.presentedValue > nineYearsType.presentedValue,
  "Senior movement should be more affected than type."
);
assert.ok(
  nineYearsMovement.presentedValue > nineYearsTemperament.presentedValue,
  "Senior movement should be more affected than temperament."
);
assert.ok(
  latePregnancyMovement.presentedValue > twoYearsMovement.presentedValue,
  "Late pregnancy should push presentation away from ideal."
);
assert.ok(
  postWhelpCoat.presentedValue > twoYearsMovement.presentedValue,
  "Post-whelp coat presentation should still be affected during the 3-month window."
);
assertClose(severeHipMovement.presentedValue, adultMovement.presentedValue);
assert.deepEqual(
  severeHipMovement.modifiers.map((modifier) => modifier.source),
  [],
  "Hip dysplasia should not apply a separate direct presentation modifier."
);
assert.ok(
  autoimmuneThyroidMovement.presentedValue === adultMovement.presentedValue,
  "Thyroid should not apply a direct movement presentation effect."
);
assert.deepEqual(
  autoimmuneThyroidMovement.modifiers.map((modifier) => modifier.source),
  [],
  "Thyroid should not apply a separate direct presentation modifier."
);
assertClose(lowHindquartersYellowHips.characteristics.MOVEMENT, 8.83);
assertClose(lowHindquartersYellowHips.characteristics.STRUCTURE_BALANCE, 9.13);
assertClose(lowHindquartersRedHips.characteristics.MOVEMENT, 8.17);
assertClose(lowHindquartersRedHips.characteristics.STRUCTURE_BALANCE, 8.63);
assertClose(highHindquartersRedHips.characteristics.MOVEMENT, 11.83);
assertClose(highHindquartersRedHips.characteristics.STRUCTURE_BALANCE, 11.38);
assert.notEqual(
  lowHindquartersYellowHips.weightedCategoryScores.MOVEMENT,
  lowHindquartersBaseline.weightedCategoryScores.MOVEMENT,
  "Yellow hips should change judging movement through expressed hindquarters."
);
assert.notEqual(
  lowHindquartersRedHips.weightedCategoryScores.STRUCTURE_BALANCE,
  lowHindquartersBaseline.weightedCategoryScores.STRUCTURE_BALANCE,
  "Red hips should change judging structure through expressed hindquarters."
);
assert.notEqual(
  highHindquartersRedHips.weightedCategoryScores.MOVEMENT,
  highHindquartersBaseline.weightedCategoryScores.MOVEMENT,
  "Red hips above ideal should change judging movement through expressed hindquarters."
);
assert.equal(
  lowHindquartersTraits.hindquarters,
  7.5,
  "Judging should not mutate stored traitHindquarters."
);
assertClose(lowForequartersYellowElbows.characteristics.MOVEMENT, 8.83);
assertClose(lowForequartersYellowElbows.characteristics.STRUCTURE_BALANCE, 9.13);
assertClose(lowForequartersRedElbows.characteristics.MOVEMENT, 8.17);
assertClose(lowForequartersRedElbows.characteristics.STRUCTURE_BALANCE, 8.63);
assertClose(highForequartersRedElbows.characteristics.MOVEMENT, 11.83);
assertClose(highForequartersRedElbows.characteristics.STRUCTURE_BALANCE, 11.38);
assert.notEqual(
  lowForequartersYellowElbows.weightedCategoryScores.MOVEMENT,
  lowForequartersBaseline.weightedCategoryScores.MOVEMENT,
  "Yellow elbows should change judging movement through expressed forequarters."
);
assert.notEqual(
  lowForequartersRedElbows.weightedCategoryScores.STRUCTURE_BALANCE,
  lowForequartersBaseline.weightedCategoryScores.STRUCTURE_BALANCE,
  "Red elbows should change judging structure through expressed forequarters."
);
assert.notEqual(
  highForequartersRedElbows.weightedCategoryScores.MOVEMENT,
  highForequartersBaseline.weightedCategoryScores.MOVEMENT,
  "Red elbows above ideal should change judging movement through expressed forequarters."
);
assert.equal(
  lowForequartersTraits.forequarters,
  7.5,
  "Judging should not mutate stored traitForequarters."
);
assert.deepEqual(
  redCardiacJudging.characteristics,
  redCardiacBaselineJudging.characteristics,
  "Cardiac should not alter judging category values directly."
);
assert.deepEqual(
  redCardiacJudging.weightedCategoryScores,
  redCardiacBaselineJudging.weightedCategoryScores,
  "Cardiac should not alter judging scores directly."
);
assert.equal(
  redCaerJudging.characteristics.TYPE_EXPRESSION,
  redCaerBaselineJudging.characteristics.TYPE_EXPRESSION,
  "CAER should not alter Type & Expression until a non-coat expression channel exists."
);
assert.notEqual(
  redCaerJudging.characteristics.TEMPERAMENT_RING_BEHAVIOR,
  redCaerBaselineJudging.characteristics.TEMPERAMENT_RING_BEHAVIOR,
  "CAER should affect Temperament & Ring Behavior through expressed traits."
);
assert.equal(
  redCaerJudging.characteristics.MOVEMENT,
  redCaerBaselineJudging.characteristics.MOVEMENT,
  "CAER should not alter Movement."
);
assert.equal(
  redCaerJudging.characteristics.STRUCTURE_BALANCE,
  redCaerBaselineJudging.characteristics.STRUCTURE_BALANCE,
  "CAER should not alter Structure & Balance."
);
assert.equal(
  redCaerJudging.characteristics.COAT_PRESENTATION,
  redCaerBaselineJudging.characteristics.COAT_PRESENTATION,
  "CAER should not alter Coat & Presentation."
);
assert.equal(
  caerTraits.show_shine,
  7.5,
  "Judging should not mutate stored traitShowShine."
);
assert.equal(
  caerTraits.temperament,
  7.5,
  "Judging should not mutate stored traitTemperament."
);
assert.equal(
  deriveShowCharacteristicsFromTraits(traits).CONDITIONING_HANDLING,
  0,
  "Conditioning/handling should not be genetically derived from show_shine."
);
assert.equal(
  deriveShowCharacteristicsFromTraits({
    ...traits,
    show_shine: 20,
  }).CONDITIONING_HANDLING,
  0,
  "Changing show_shine should not change conditioning/handling."
);

console.table([
  {
    stage: "6 months",
    category: "Movement",
    trueValue: sixMonthsMovement.baseValue,
    presented: sixMonthsMovement.presentedValue,
    multiplier: sixMonthsMovement.multiplier,
  },
  {
    stage: "18 months",
    category: "Movement",
    trueValue: eighteenMonthsMovement.baseValue,
    presented: eighteenMonthsMovement.presentedValue,
    multiplier: eighteenMonthsMovement.multiplier,
  },
  {
    stage: "2 years",
    category: "Movement",
    trueValue: twoYearsMovement.baseValue,
    presented: twoYearsMovement.presentedValue,
    multiplier: twoYearsMovement.multiplier,
  },
  {
    stage: "4 years",
    category: "Movement",
    trueValue: fourYearsMovement.baseValue,
    presented: fourYearsMovement.presentedValue,
    multiplier: fourYearsMovement.multiplier,
  },
  {
    stage: "5 years",
    category: "Movement",
    trueValue: fiveYearsMovement.baseValue,
    presented: fiveYearsMovement.presentedValue,
    multiplier: fiveYearsMovement.multiplier,
  },
  {
    stage: "9 years",
    category: "Movement",
    trueValue: nineYearsMovement.baseValue,
    presented: nineYearsMovement.presentedValue,
    multiplier: nineYearsMovement.multiplier,
  },
  {
    stage: "6 months under ideal",
    category: "Movement",
    trueValue: sixMonthsUnderIdealMovement.baseValue,
    presented: sixMonthsUnderIdealMovement.presentedValue,
    multiplier: sixMonthsUnderIdealMovement.multiplier,
  },
  {
    stage: "9 years",
    category: "Type",
    trueValue: nineYearsType.baseValue,
    presented: nineYearsType.presentedValue,
    multiplier: nineYearsType.multiplier,
  },
  {
    stage: "9 years",
    category: "Temperament",
    trueValue: nineYearsTemperament.baseValue,
    presented: nineYearsTemperament.presentedValue,
    multiplier: nineYearsTemperament.multiplier,
  },
  {
    stage: "Late pregnancy",
    category: "Movement",
    trueValue: latePregnancyMovement.baseValue,
    presented: latePregnancyMovement.presentedValue,
    multiplier: latePregnancyMovement.multiplier,
  },
  {
    stage: "9 weeks post-whelp",
    category: "Coat",
    trueValue: postWhelpCoat.baseValue,
    presented: postWhelpCoat.presentedValue,
    multiplier: postWhelpCoat.multiplier,
  },
  {
    stage: "Severe hip dysplasia direct modifier",
    category: "Movement",
    trueValue: severeHipMovement.baseValue,
    presented: severeHipMovement.presentedValue,
    multiplier: severeHipMovement.multiplier,
  },
  {
    stage: "Autoimmune thyroiditis",
    category: "Movement",
    trueValue: autoimmuneThyroidMovement.baseValue,
    presented: autoimmuneThyroidMovement.presentedValue,
    multiplier: autoimmuneThyroidMovement.multiplier,
  },
]);

console.log("Presentation modifier theory checks passed.");
