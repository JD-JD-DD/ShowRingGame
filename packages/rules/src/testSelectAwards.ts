import { strict as assert } from "node:assert";

import {
  DEFAULT_CATEGORY_WEIGHTS,
  judgeBreedBlock,
  type Dog,
  type Judge,
  type JudgedShowAward,
} from "./index";

const judge: Judge = {
  judgeId: "judge-select-awards",
  name: "Select Awards Judge",
  style: "BALANCED",
  categoryWeights: { ...DEFAULT_CATEGORY_WEIGHTS },
};

function dog(id: string, sex: "M" | "F", traitValue: number): Dog {
  return {
    dogId: id,
    regNumber: id,
    breedCode2: "TST",
    birthEpoch: 0,
    sex,
    status: "ALIVE",
    litterId: null,
    litterOrder: null,
    sireId: null,
    damId: null,
    traits: {
      head: traitValue,
      forequarters: traitValue,
      hindquarters: traitValue,
      gait: traitValue,
      coat: traitValue,
      size: traitValue,
      temperament: traitValue,
      show_shine: traitValue,
      feet: traitValue,
      topline: traitValue,
    },
  };
}

function awardsFor(
  entries: Array<{ dog: Dog; isChampion?: boolean }>
): JudgedShowAward[] {
  return judgeBreedBlock({
    judge,
    random01: () => 0.5,
    entries: entries.map((entry, index) => ({
      showEntryId: `entry-${index + 1}`,
      ...entry,
    })),
  }).awards;
}

function awardDogId(
  awards: JudgedShowAward[],
  awardCode: "BOB" | "BOS" | "SELECT_DOG" | "SELECT_BITCH"
): string | null {
  return awards.find((award) => award.awardCode === awardCode)?.dogId ?? null;
}

function pointAward(
  awards: JudgedShowAward[],
  awardCode: "SELECT_DOG" | "SELECT_BITCH"
): JudgedShowAward | null {
  return awards.find((award) => award.awardCode === awardCode) ?? null;
}

{
  const awards = awardsFor([
    { dog: dog("bob-male-special", "M", 10), isChampion: true },
    { dog: dog("bos-female-special", "F", 9.8), isChampion: true },
    { dog: dog("select-male-special", "M", 9.6), isChampion: true },
    { dog: dog("class-male", "M", 9.4) },
    { dog: dog("class-female", "F", 9.2) },
  ]);

  assert.equal(awardDogId(awards, "BOB"), "bob-male-special");
  assert.equal(awardDogId(awards, "BOS"), "bos-female-special");
  assert.equal(awardDogId(awards, "SELECT_DOG"), "select-male-special");
  assert.equal(awardDogId(awards, "SELECT_BITCH"), null);
  assert.equal(pointAward(awards, "SELECT_DOG")?.pointsAwarded, 0);
  assert.equal(pointAward(awards, "SELECT_DOG")?.isMajor, false);
}

{
  const awards = awardsFor([
    { dog: dog("bob-female-special", "F", 10), isChampion: true },
    { dog: dog("bos-male-special", "M", 9.8), isChampion: true },
    { dog: dog("select-female-special", "F", 9.6), isChampion: true },
    { dog: dog("class-male", "M", 9.4) },
    { dog: dog("class-female", "F", 9.2) },
  ]);

  assert.equal(awardDogId(awards, "BOB"), "bob-female-special");
  assert.equal(awardDogId(awards, "BOS"), "bos-male-special");
  assert.equal(awardDogId(awards, "SELECT_DOG"), null);
  assert.equal(awardDogId(awards, "SELECT_BITCH"), "select-female-special");
  assert.equal(pointAward(awards, "SELECT_BITCH")?.pointsAwarded, 0);
  assert.equal(pointAward(awards, "SELECT_BITCH")?.isMajor, false);
}

{
  const awards = awardsFor([
    { dog: dog("bob-male-special", "M", 10), isChampion: true },
    { dog: dog("bos-female-special", "F", 9.8), isChampion: true },
    { dog: dog("class-male-not-select", "M", 9.6) },
    { dog: dog("class-female-not-select", "F", 9.4) },
  ]);

  assert.equal(awardDogId(awards, "SELECT_DOG"), null);
  assert.equal(awardDogId(awards, "SELECT_BITCH"), null);
}

{
  const awards = awardsFor([
    { dog: dog("bob-male-special", "M", 10), isChampion: true },
    { dog: dog("bos-female-special", "F", 9.8), isChampion: true },
    { dog: dog("select-male-special", "M", 9.6), isChampion: true },
    { dog: dog("select-female-special", "F", 9.4), isChampion: true },
  ]);

  assert.equal(awardDogId(awards, "SELECT_DOG"), "select-male-special");
  assert.equal(awardDogId(awards, "SELECT_BITCH"), "select-female-special");
}

console.log("Select award tests passed.");
