import {
  getClusterEntryQuote,
  getPuppyRehomePayoutForAgeHours,
} from "../engines/economy.engine";
import { TRAVELING_HANDLER_FEE } from "../constants/economy.constants";
import { DAM_SHOW_POST_WHELP_COOLDOWN_HOURS } from "../constants/lifecycle.constants";
import { canEnterShows, canRehomeDog } from "./lifecycle";

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
  1,
  "3 new dogs after 3 existing require one handler"
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

function handlerQuote(args: {
  existing?: Record<string, Record<string, string[]>>;
  dogs: Array<{ dogId: string; breed: string; showDayIds: string[] }>;
}) {
  return getClusterEntryQuote({
    homeDistrict: 3,
    clusterDistrict: 3,
    ledgerBalance: 10_000,
    existingDogIdsByShowDayAndBreed: args.existing,
    dogs: args.dogs.map((dog) => ({
      dogId: dog.dogId,
      dogName: dog.dogId,
      breed: dog.breed,
      sex: "Dog" as const,
      selectedShowDays: dog.showDayIds,
    })),
  });
}

function dogs(breed: string, count: number, showDayIds: string[]) {
  return Array.from({ length: count }, (_, index) => ({
    dogId: `${breed}-${index + 1}`,
    breed,
    showDayIds,
  }));
}

assertEqual(handlerQuote({ dogs: dogs("A", 3, ["fri"]) }).handlerFee, 0, "A: three dogs need no handler");
assertEqual(handlerQuote({ dogs: dogs("A", 4, ["fri"]) }).handlerFee, 100, "B: four dogs need one handler");
assertEqual(handlerQuote({ dogs: dogs("A", 6, ["fri"]) }).handlerFee, 100, "C: six dogs share one handler");
assertEqual(handlerQuote({ dogs: dogs("A", 7, ["fri"]) }).handlerFee, 200, "D: seven dogs need two handlers");
assertEqual(handlerQuote({ dogs: dogs("A", 3, ["fri"]) }).handlerDogs, 0, "A: handler count is zero");
assertEqual(handlerQuote({ dogs: dogs("A", 4, ["fri"]) }).handlerDogs, 1, "B: handler count is one");
assertEqual(handlerQuote({ dogs: dogs("A", 6, ["fri"]) }).handlerDogs, 1, "C: handler count is one");
assertEqual(handlerQuote({ dogs: dogs("A", 7, ["fri"]) }).handlerDogs, 2, "D: handler count is two");
assertEqual(handlerQuote({ dogs: [...dogs("A", 3, ["fri"]), ...dogs("B", 2, ["fri"]), ...dogs("C", 3, ["fri"])] }).handlerFee, 0, "E: breed allowances stay independent");
assertEqual(handlerQuote({ dogs: [...dogs("A", 3, ["fri"]), ...dogs("B", 2, ["fri"]), ...dogs("C", 4, ["fri"])] }).handlerFee, 100, "F: only the fourth C dog requires a handler");
assertEqual(handlerQuote({ dogs: [...dogs("A", 4, ["fri"]), ...dogs("B", 3, ["sat"])] }).handlerFee, 100, "G: Friday and Saturday stay independent");
assertEqual(handlerQuote({ dogs: [...dogs("A", 4, ["fri"]), ...dogs("A", 4, ["sat"])] }).handlerFee, 200, "H: each day requires its own handler");
assertEqual(handlerQuote({ dogs: [...dogs("A", 4, ["fri"]), ...dogs("B", 4, ["fri"])] }).handlerFee, 200, "I: each breed requires its own handler");
assertEqual(handlerQuote({ existing: { fri: { A: ["A-1", "A-2", "A-3"] } }, dogs: [{ dogId: "A-4", breed: "A", showDayIds: ["fri"] }] }).handlerFee, 100, "J: the fourth incremental dog adds one handler");
assertEqual(handlerQuote({ existing: { fri: { A: ["A-1", "A-2"] } }, dogs: ["A-3", "A-4", "A-5"].map((dogId) => ({ dogId, breed: "A", showDayIds: ["fri"] })) }).handlerFee, 100, "K: five final dogs still require one handler");
assertEqual(handlerQuote({ dogs: dogs("A", 3, ["fri", "sat"]) }).handlerFee, 0, "L: the same dogs are counted independently per day");

const transitionFees = [
  handlerQuote({ dogs: dogs("A", 3, ["fri"]) }).handlerFee,
  handlerQuote({ existing: { fri: { A: dogs("A", 3, ["fri"]).map((dog) => dog.dogId) } }, dogs: [{ dogId: "A-4", breed: "A", showDayIds: ["fri"] }] }).handlerFee,
  handlerQuote({ existing: { fri: { A: dogs("A", 4, ["fri"]).map((dog) => dog.dogId) } }, dogs: dogs("A", 1, ["fri"]).map((dog) => ({ ...dog, dogId: "A-5" })) }).handlerFee,
  handlerQuote({ existing: { fri: { A: dogs("A", 5, ["fri"]).map((dog) => dog.dogId) } }, dogs: [{ ...dogs("A", 1, ["fri"])[0], dogId: "A-6" }] }).handlerFee,
  handlerQuote({ existing: { fri: { A: dogs("A", 6, ["fri"]).map((dog) => dog.dogId) } }, dogs: [{ ...dogs("A", 1, ["fri"])[0], dogId: "A-7" }] }).handlerFee,
];
assertEqual(transitionFees.reduce((sum, fee) => sum + fee, 0), 200, "incremental threshold fees match seven dogs entered together");
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
assertEqual(Number(canEnterShows(1000, 0, "ALIVE")), 1, "adult can show");
assertEqual(
  Number(canEnterShows(1000, 0, "ALIVE", { isPregnant: true })),
  0,
  "confirmed pregnant bitch cannot show"
);
assertEqual(
  Number(
    canEnterShows(1000, 0, "ALIVE", {
      lastWhelpedEpoch: 1000 - DAM_SHOW_POST_WHELP_COOLDOWN_HOURS + 1,
    })
  ),
  0,
  "bitch cannot show before 8 weeks post-whelp"
);
assertEqual(
  Number(
    canEnterShows(1000, 0, "ALIVE", {
      lastWhelpedEpoch: 1000 - DAM_SHOW_POST_WHELP_COOLDOWN_HOURS,
    })
  ),
  1,
  "bitch can show at 8 weeks post-whelp"
);

console.log("CLUSTER ENTRY QUOTE");
console.log(JSON.stringify(quote, null, 2));
console.log("QUOTE TESTS PASSED");
