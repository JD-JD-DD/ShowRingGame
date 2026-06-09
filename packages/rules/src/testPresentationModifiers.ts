import { strict as assert } from "node:assert";
import {
  applyPresentationModifiersToCharacteristics,
  deriveShowCharacteristicsFromTraits,
  type Dog,
  type DogTraits,
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
const moderateHipMovement = presentedValue({
  ageHours: 3 * SHOW_YEAR_HOURS,
  category: "MOVEMENT",
  presentation: {
    phenotypeHealthTruths: [
      {
        conditionCode: "HIP_DYSPLASIA",
        geneticLiability: 0.76,
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
assert.ok(
  severeHipMovement.presentedValue > moderateHipMovement.presentedValue,
  "Severe hip dysplasia should affect movement more than moderate hip dysplasia."
);
assert.ok(
  autoimmuneThyroidMovement.presentedValue > twoYearsMovement.presentedValue,
  "Autoimmune thyroiditis should have a mild movement presentation effect."
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
    stage: "Moderate hip dysplasia",
    category: "Movement",
    trueValue: moderateHipMovement.baseValue,
    presented: moderateHipMovement.presentedValue,
    multiplier: moderateHipMovement.multiplier,
  },
  {
    stage: "Severe hip dysplasia",
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
