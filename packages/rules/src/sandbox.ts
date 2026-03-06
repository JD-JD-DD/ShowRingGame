import { getClusterEntryQuote } from "../engines/economy.engine";

/**
 * Simple helper to print section headers clearly in terminal output.
 */
function printHeader(title: string): void {
  console.log("\n========================================");
  console.log(title);
  console.log("========================================");
}

/**
 * Scenario 1:
 * Two dogs, moderate travel, enough money.
 */
function runScenarioBasicAffordable(): void {
  printHeader("SCENARIO 1: BASIC AFFORDABLE ENTRY");

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

  console.log(JSON.stringify(quote, null, 2));
}

/**
 * Scenario 2:
 * Four dogs should trigger handler fee.
 */
function runScenarioHandlerTriggered(): void {
  printHeader("SCENARIO 2: HANDLER TRIGGERED AT 4 DOGS");

  const quote = getClusterEntryQuote({
    homeDistrict: 3,
    clusterDistrict: 7,
    ledgerBalance: 2000,
    dogs: [
      {
        dogId: "dog-1",
        dogName: "Rex",
        breed: "Weimaraner",
        sex: "Dog",
        points: 8,
        selectedShowDays: [1, 2],
      },
      {
        dogId: "dog-2",
        dogName: "Luna",
        breed: "Weimaraner",
        sex: "Bitch",
        points: 2,
        selectedShowDays: [1, 2],
      },
      {
        dogId: "dog-3",
        dogName: "Jett",
        breed: "Weimaraner",
        sex: "Dog",
        points: 0,
        selectedShowDays: [1],
      },
      {
        dogId: "dog-4",
        dogName: "Echo",
        breed: "Weimaraner",
        sex: "Bitch",
        points: 0,
        selectedShowDays: [1, 2, 3],
      },
    ],
  });

  console.log(JSON.stringify(quote, null, 2));
}

/**
 * Scenario 3:
 * Player cannot afford the trip.
 */
function runScenarioCannotAfford(): void {
  printHeader("SCENARIO 3: INSUFFICIENT LEDGER BALANCE");

  const quote = getClusterEntryQuote({
    homeDistrict: 1,
    clusterDistrict: 15,
    ledgerBalance: 100,
    dogs: [
      {
        dogId: "dog-1",
        dogName: "Rex",
        breed: "Weimaraner",
        sex: "Dog",
        points: 8,
        selectedShowDays: [1, 2, 3, 4],
      },
      {
        dogId: "dog-2",
        dogName: "Luna",
        breed: "Weimaraner",
        sex: "Bitch",
        points: 2,
        selectedShowDays: [1, 2, 3, 4],
      },
    ],
  });

  console.log(JSON.stringify(quote, null, 2));
}

/**
 * Scenario 4:
 * No selected days should produce zero entries.
 */
function runScenarioNoEntries(): void {
  printHeader("SCENARIO 4: NO ACTUAL ENTRIES SELECTED");

  const quote = getClusterEntryQuote({
    homeDistrict: 5,
    clusterDistrict: 5,
    ledgerBalance: 500,
    dogs: [
      {
        dogId: "dog-1",
        dogName: "Rex",
        breed: "Weimaraner",
        sex: "Dog",
        points: 8,
        selectedShowDays: [],
      },
      {
        dogId: "dog-2",
        dogName: "Luna",
        breed: "Weimaraner",
        sex: "Bitch",
        points: 2,
        selectedShowDays: [],
      },
    ],
  });

  console.log(JSON.stringify(quote, null, 2));
}

/**
 * Main runner.
 * Add or remove scenarios here as needed.
 */
function main(): void {
  runScenarioBasicAffordable();
  runScenarioHandlerTriggered();
  runScenarioCannotAfford();
  runScenarioNoEntries();
}

main();