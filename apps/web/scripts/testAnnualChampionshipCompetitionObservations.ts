import assert from "node:assert/strict";

import { getAnnualChampionshipCompetitionObservations } from "../server/services/annualChampionshipCompetitionObservation.service";

type AwardFixture = {
  id: string;
  showDayId: string;
  breedCode2: string;
  awardGroup: string;
  awardCode: string;
  dogsInCompetition: number | null;
  showDay: { cluster: { id: string; year: number; district: number } };
};

function fixtureClient(rows: AwardFixture[]) {
  return {
    showAward: {
      findMany: async ({ where }: { where: { showDay: { cluster: { year: number } } } }) =>
        rows.filter(
          (row) =>
            row.awardGroup === "WINNERS" &&
            ["WD", "WB"].includes(row.awardCode) &&
            row.dogsInCompetition !== null &&
            row.showDay.cluster.year === where.showDay.cluster.year
        ),
    },
  };
}

async function main() {
  const observations = await getAnnualChampionshipCompetitionObservations({
    client: fixtureClient([
      { id: "wd-1", showDayId: "day-1", breedCode2: "GR", awardGroup: "WINNERS", awardCode: "WD", dogsInCompetition: 8, showDay: { cluster: { id: "regular-16-a", year: 16, district: 3 } } },
      { id: "wd-2", showDayId: "day-2", breedCode2: "GR", awardGroup: "WINNERS", awardCode: "WD", dogsInCompetition: 11, showDay: { cluster: { id: "regular-16-b", year: 16, district: 3 } } },
      { id: "wb-1", showDayId: "day-3", breedCode2: "GR", awardGroup: "WINNERS", awardCode: "WB", dogsInCompetition: 7, showDay: { cluster: { id: "regular-16-c", year: 16, district: 3 } } },
      { id: "zero", showDayId: "day-4", breedCode2: "GR", awardGroup: "WINNERS", awardCode: "WD", dogsInCompetition: 0, showDay: { cluster: { id: "regular-16-d", year: 16, district: 3 } } },
      { id: "old", showDayId: "day-5", breedCode2: "GR", awardGroup: "WINNERS", awardCode: "WD", dogsInCompetition: 9, showDay: { cluster: { id: "regular-15", year: 15, district: 9 } } },
      { id: "invitational", showDayId: "day-6", breedCode2: "GR", awardGroup: "WINNERS", awardCode: "WB", dogsInCompetition: 12, showDay: { cluster: { id: "invitational-year-16", year: 16, district: 1 } } },
      { id: "bob", showDayId: "day-7", breedCode2: "GR", awardGroup: "BREED", awardCode: "BOB", dogsInCompetition: 20, showDay: { cluster: { id: "regular-16-e", year: 16, district: 3 } } },
      { id: "bow", showDayId: "day-8", breedCode2: "GR", awardGroup: "WINNERS", awardCode: "BOW", dogsInCompetition: 10, showDay: { cluster: { id: "regular-16-f", year: 16, district: 3 } } },
    ]) as never,
    sourceYear: 16,
  });

  assert.deepEqual(
    observations.map(({ showAwardId, sourceYear, district, breedCode2, sex, dogsInCompetition }) => ({ showAwardId, sourceYear, district, breedCode2, sex, dogsInCompetition })),
    [
      { showAwardId: "wd-1", sourceYear: 16, district: 3, breedCode2: "GR", sex: "M", dogsInCompetition: 8 },
      { showAwardId: "wd-2", sourceYear: 16, district: 3, breedCode2: "GR", sex: "M", dogsInCompetition: 11 },
      { showAwardId: "wb-1", sourceYear: 16, district: 3, breedCode2: "GR", sex: "F", dogsInCompetition: 7 },
      { showAwardId: "zero", sourceYear: 16, district: 3, breedCode2: "GR", sex: "M", dogsInCompetition: 0 },
    ],
    "returns only persisted regular-show WD/WB observations, preserving zero counts"
  );
  console.log("Annual Championship competition observation checks passed.");
}

void main();
