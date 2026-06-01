import {
  getClusterEntryQuote,
  getPuppyRehomePayoutForAgeHours,
} from "../engines/economy.engine";
import { TRAVELING_HANDLER_FEE } from "../constants/economy.constants";
import { canRehomeDog } from "./lifecycle";

function assertEqual(actual: number, expected: number, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

const quote = getClusterEntryQuote({
  homeDistrict: 3,
  clusterDistrict: 7,
  ledgerBalance: 1000,
  dogs: [
    {
      dogId: "dog-1",
      dogName: "Rex",
      breed: "Weimaraner",
      sex: "Dog",
      points: 8,
      selectedShowDays: [1, 2, 3],
    },
    {
      dogId: "dog-2",
      dogName: "Luna",
      breed: "Weimaraner",
      sex: "Bitch",
      points: 2,
      selectedShowDays: [1, 2],
    },
  ],
});

const threeDogsOneBreed = getClusterEntryQuote({
  homeDistrict: 3,
  clusterDistrict: 7,
  ledgerBalance: 1000,
  dogs: ["dog-1", "dog-2", "dog-3"].map((dogId) => ({
    dogId,
    dogName: dogId,
    breed: "Weimaraner",
    sex: "Dog" as const,
    selectedShowDays: [1],
  })),
});

const fourDogsOneBreed = getClusterEntryQuote({
  homeDistrict: 3,
  clusterDistrict: 7,
  ledgerBalance: 1000,
  dogs: ["dog-1", "dog-2", "dog-3", "dog-4"].map((dogId) => ({
    dogId,
    dogName: dogId,
    breed: "Weimaraner",
    sex: "Dog" as const,
    selectedShowDays: [1],
  })),
});

const threeDogsTwoBreeds = getClusterEntryQuote({
  homeDistrict: 3,
  clusterDistrict: 7,
  ledgerBalance: 1000,
  dogs: [
    ["dog-1", "Weimaraner"],
    ["dog-2", "Weimaraner"],
    ["dog-3", "Weimaraner"],
    ["dog-4", "Saluki"],
    ["dog-5", "Saluki"],
    ["dog-6", "Saluki"],
  ].map(([dogId, breed]) => ({
    dogId,
    dogName: dogId,
    breed,
    sex: "Dog" as const,
    selectedShowDays: [1],
  })),
});

const addThreeAfterThreeExisting = getClusterEntryQuote({
  homeDistrict: 3,
  clusterDistrict: 7,
  ledgerBalance: 1000,
  existingDogIdsByBreed: {
    Weimaraner: ["dog-1", "dog-2", "dog-3"],
  },
  dogs: ["dog-4", "dog-5", "dog-6"].map((dogId) => ({
    dogId,
    dogName: dogId,
    breed: "Weimaraner",
    sex: "Dog" as const,
    selectedShowDays: [1],
  })),
});

const addDayForExistingDogs = getClusterEntryQuote({
  homeDistrict: 3,
  clusterDistrict: 7,
  ledgerBalance: 1000,
  existingDogIdsByBreed: {
    Weimaraner: ["dog-1", "dog-2", "dog-3"],
  },
  dogs: ["dog-1", "dog-2"].map((dogId) => ({
    dogId,
    dogName: dogId,
    breed: "Weimaraner",
    sex: "Dog" as const,
    selectedShowDays: [2],
  })),
});

const secondaryShow = getClusterEntryQuote({
  homeDistrict: 3,
  clusterDistrict: 7,
  ledgerBalance: 1000,
  showRole: "SECONDARY",
  dogs: ["dog-1", "dog-2"].map((dogId) => ({
    dogId,
    dogName: dogId,
    breed: "Weimaraner",
    sex: "Dog" as const,
    selectedShowDays: [1, 2],
  })),
});

const secondaryAdditionalDay = getClusterEntryQuote({
  homeDistrict: 3,
  clusterDistrict: 7,
  ledgerBalance: 1000,
  showRole: "SECONDARY",
  existingDogIdsByBreed: {
    Weimaraner: ["dog-1", "dog-2"],
  },
  dogs: ["dog-1", "dog-2"].map((dogId) => ({
    dogId,
    dogName: dogId,
    breed: "Weimaraner",
    sex: "Dog" as const,
    selectedShowDays: [3],
  })),
});

assertEqual(threeDogsOneBreed.handlerDogs, 0, "3 dogs in one breed");
assertEqual(fourDogsOneBreed.handlerDogs, 1, "4 dogs in one breed");
assertEqual(threeDogsTwoBreeds.handlerDogs, 0, "3 dogs in each of two breeds");
assertEqual(
  addThreeAfterThreeExisting.handlerDogs,
  3,
  "3 new dogs after 3 existing"
);
assertEqual(
  addDayForExistingDogs.handlerDogs,
  0,
  "additional days for existing dogs"
);
assertEqual(secondaryShow.handlerDogs, 2, "secondary handler dogs");
assertEqual(
  secondaryShow.handlerFee,
  2 * TRAVELING_HANDLER_FEE,
  "secondary handler fee"
);
assertEqual(
  secondaryAdditionalDay.handlerDogs,
  0,
  "secondary existing dog additional days"
);
assertEqual(getPuppyRehomePayoutForAgeHours(55), 0, "puppy re-home before 8 weeks");
assertEqual(getPuppyRehomePayoutForAgeHours(56), 100, "puppy re-home at 8 weeks");
assertEqual(
  getPuppyRehomePayoutForAgeHours(181),
  100,
  "puppy re-home before 6 months"
);
assertEqual(getPuppyRehomePayoutForAgeHours(182), 0, "puppy re-home at 6 months");
assertEqual(Number(canRehomeDog(55, 0, "ALIVE")), 0, "re-home before 8 weeks");
assertEqual(Number(canRehomeDog(56, 0, "ALIVE")), 1, "re-home at 8 weeks");
assertEqual(Number(canRehomeDog(500, 0, "ALIVE")), 1, "adult re-home");

console.log("CLUSTER ENTRY QUOTE");
console.log(JSON.stringify(quote, null, 2));
console.log("QUOTE TESTS PASSED");
