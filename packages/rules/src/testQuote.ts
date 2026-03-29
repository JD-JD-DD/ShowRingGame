import { getClusterEntryQuote } from "../engines/economy.engine";

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

console.log("CLUSTER ENTRY QUOTE");
console.log(JSON.stringify(quote, null, 2));
