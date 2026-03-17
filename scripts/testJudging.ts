import {
  sampleDogs,
  sampleJudges, } from "../packages/rules/src/index";

import { rankDogsByJudgeWeights } from "../packages/rules/engines/judging.engine";


function formatNumber(value: number): string {
  return value.toFixed(2);
}

function main(): void {
  const judge = sampleJudges[0];

  if (!judge) {
    throw new Error("No sample judge found.");
  }

  if (sampleDogs.length === 0) {
    throw new Error("No sample dogs found.");
  }

  const results = rankDogsByJudgeWeights({
    dogs: sampleDogs,
    judge,
  });

  console.log("======================================");
  console.log("JUDGING SANDBOX");
  console.log("======================================");
  console.log(`Judge: ${judge.name}`);
  console.log(`Style: ${judge.style}`);
  console.log("Category Weights:");
  console.log(judge.categoryWeights);
  console.log("");

  results.forEach((result, index) => {
    console.log("--------------------------------------");
    console.log(`Placement: #${index + 1}`);
    console.log(`Dog ID: ${result.dogId}`);
    console.log(`Reg Number: ${result.regNumber}`);
    console.log(`Base Score: ${formatNumber(result.baseScore)}`);
    console.log("");

    console.log("Derived Characteristics:");
    for (const [category, value] of Object.entries(result.characteristics)) {
      console.log(`  ${category}: ${formatNumber(value)}`);
    }

    console.log("");
    console.log("Weighted Category Scores:");
    for (const [category, value] of Object.entries(result.weightedCategoryScores)) {
      console.log(`  ${category}: ${formatNumber(value)}`);
    }

    console.log("");
  });
}

main();