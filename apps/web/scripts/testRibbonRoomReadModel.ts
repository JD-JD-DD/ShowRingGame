import { strict as assert } from "node:assert";

import {
  buildInvitationalHistory,
  buildRibbonRoomMilestones,
  buildRibbonTotals,
  findChampionMilestone,
  findGrandChampionMilestone,
  summarizeChampionProgress,
  summarizeGrandChampionProgress,
} from "../server/services/ribbonRoom.service";

const show = (year: number, week: number, id = `show-${year}-${week}`) => ({
  scheduledEpoch: (year - 1) * 365 + (week - 1) * 7,
  cluster: {
    id,
    name: `Year ${year} Week ${week}`,
    year,
  },
});

const judge = (id: string) => ({ id, name: `Judge ${id}` });

{
  const totals = buildRibbonTotals([
    {
      awardCode: "BIS",
      awardGroup: "BEST_IN_SHOW",
      pointsAwarded: 0,
      dogPrestigeCredit: { breedDogsBeaten: 0, allBreedDogsBeaten: 85 },
      grandChampionCredit: null,
      showDay: show(4, 20),
      judge: judge("a"),
    },
    {
      awardCode: "BIS",
      awardGroup: "BEST_IN_SHOW",
      pointsAwarded: 0,
      dogPrestigeCredit: { breedDogsBeaten: 0, allBreedDogsBeaten: 90 },
      grandChampionCredit: null,
      showDay: show(5, 8),
      judge: judge("b"),
    },
    {
      awardCode: "G1",
      awardGroup: "GROUP",
      pointsAwarded: 0,
      dogPrestigeCredit: { breedDogsBeaten: 12, allBreedDogsBeaten: 64 },
      grandChampionCredit: null,
      showDay: show(5, 10),
      judge: judge("c"),
    },
    {
      awardCode: "BOB",
      awardGroup: "BREED",
      pointsAwarded: 3,
      dogPrestigeCredit: { breedDogsBeaten: 17, allBreedDogsBeaten: 0 },
      grandChampionCredit: { pointsAwarded: 2 },
      showDay: show(3, 11),
      judge: judge("d"),
    },
    {
      awardCode: "SELECT_DOG",
      awardGroup: "BREED",
      pointsAwarded: 0,
      dogPrestigeCredit: { breedDogsBeaten: 8, allBreedDogsBeaten: 0 },
      grandChampionCredit: { pointsAwarded: 1 },
      showDay: show(3, 12),
      judge: judge("e"),
    },
  ]);

  assert.equal(totals.find((total) => total.award === "BIS")?.count, 2);
  assert.equal(totals.find((total) => total.award === "G1")?.count, 1);
  assert.equal(totals.find((total) => total.award === "BOB")?.count, 1);
  assert.equal(totals.find((total) => total.award === "SELECT")?.count, 1);
  assert.equal(
    totals.find((total) => total.award === "BIS")?.history[0]?.dogsDefeated,
    85
  );
  assert.equal(
    totals.find((total) => total.award === "BOB")?.history[0]?.dogsDefeated,
    17
  );
  assert.equal(
    totals.find((total) => total.award === "BOB")?.history[0]?.pointsEarned,
    2
  );
}

{
  assert.deepEqual(
    buildInvitationalHistory([
      { year: 12 },
      { year: 11 },
      { year: 12, awardCode: "BOB" },
      { year: 12, awardCode: "G1" },
      { year: 13, awardCode: "SELECT_BITCH" },
    ]),
    [
      { year: 11, week: 52, status: "INVITED" },
      { year: 12, week: 52, status: "GROUP_FIRST" },
      { year: 13, week: 52, status: "SELECT" },
    ]
  );
}

{
  const champion = findChampionMilestone([
    {
      showDayId: "day-1",
      pointsAwarded: 4,
      isMajor: true,
      year: 2,
      week: 3,
      scheduledEpoch: 380,
    },
    {
      showDayId: "day-2",
      pointsAwarded: 8,
      isMajor: false,
      year: 2,
      week: 6,
      scheduledEpoch: 401,
    },
    {
      showDayId: "day-3",
      pointsAwarded: 3,
      isMajor: true,
      year: 2,
      week: 8,
      scheduledEpoch: 415,
    },
  ]);

  assert.deepEqual(champion, { type: "CHAMPION", year: 2, week: 8 });

  const grandChampion = findGrandChampionMilestone([
    {
      showDayId: "gch-1",
      pointsAwarded: 10,
      isMajor: true,
      countsAsChampionDefeat: true,
      year: 3,
      week: 1,
      scheduledEpoch: 730,
    },
    {
      showDayId: "gch-2",
      pointsAwarded: 10,
      isMajor: true,
      countsAsChampionDefeat: true,
      year: 3,
      week: 5,
      scheduledEpoch: 758,
    },
    {
      showDayId: "gch-3",
      pointsAwarded: 5,
      isMajor: true,
      countsAsChampionDefeat: true,
      year: 3,
      week: 9,
      scheduledEpoch: 786,
    },
  ]);

  assert.deepEqual(grandChampion, {
    type: "GRAND_CHAMPION",
    year: 3,
    week: 9,
  });
}

{
  const milestones = buildRibbonRoomMilestones({
    entries: [{ year: 1, week: 8, scheduledEpoch: 49 }],
    awards: [
      { awardCode: "G1", year: 4, week: 2, scheduledEpoch: 1100 },
      { awardCode: "BOB", year: 2, week: 3, scheduledEpoch: 380 },
      { awardCode: "BIS", year: 5, week: 1, scheduledEpoch: 1460 },
    ],
    pointAwards: [
      {
        showDayId: "day-1",
        pointsAwarded: 15,
        isMajor: true,
        year: 2,
        week: 20,
        scheduledEpoch: 499,
      },
    ],
    grandChampionCredits: [],
    invitationalQualifications: [{ year: 3, week: 52, scheduledEpoch: 1090 }],
    invitationalPlacements: [
      { awardCode: "G2", year: 4, week: 52, scheduledEpoch: 1450 },
    ],
  });

  assert.deepEqual(
    milestones.map((milestone) => milestone.type),
    [
      "FIRST_ENTRY",
      "FIRST_RIBBON",
      "FIRST_BOB",
      "FIRST_INVITATIONAL_QUALIFICATION",
      "FIRST_GROUP",
      "FIRST_G1",
      "FIRST_INVITATIONAL_PLACEMENT",
      "FIRST_BIS",
    ]
  );
}

{
  const champion = summarizeChampionProgress({
    titleProgress: {
      championshipPoints: 15,
      majorCount: 2,
      grandPoints: 0,
      grandMajorCount: 0,
      grandChampionDefeatShowCount: 0,
      currentTitleCode: "CH",
    },
    judgeIds: ["a", "b", "a"],
  });

  assert.deepEqual(champion, {
    points: 15,
    majors: 2,
    judges: 2,
    completed: true,
    title: "CH",
  });

  const grandChampion = summarizeGrandChampionProgress({
    titleProgress: {
      championshipPoints: 15,
      majorCount: 2,
      grandPoints: 25,
      grandMajorCount: 3,
      grandChampionDefeatShowCount: 3,
      currentTitleCode: "CH",
    },
    judgeIds: ["g1", "g2", "g3", "g2"],
  });

  assert.deepEqual(grandChampion, {
    points: 25,
    majors: 3,
    judges: 3,
    completed: true,
    level: "GCH",
  });
}

console.log("Ribbon Room read model tests passed.");
