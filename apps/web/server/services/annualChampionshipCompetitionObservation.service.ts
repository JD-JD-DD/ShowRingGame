import { type Prisma, type PrismaClient, type Sex } from "@prisma/client";

import { isInvitationalClusterId } from "./invitational.service";

type ObservationClient = Pick<Prisma.TransactionClient, "showAward">;

export type AnnualChampionshipCompetitionObservation = {
  showAwardId: string;
  showDayId: string;
  sourceYear: number;
  district: number;
  breedCode2: string;
  sex: Sex;
  dogsInCompetition: number;
};

/**
 * Returns persisted WD/WB judging-time competition counts for regular shows.
 * The historical count is read directly from ShowAward and is never rebuilt
 * from present-day dogs, entries, titles, or regular-class structure.
 */
export async function getAnnualChampionshipCompetitionObservations(args: {
  client: ObservationClient;
  sourceYear: number;
}): Promise<AnnualChampionshipCompetitionObservation[]> {
  const awards = await args.client.showAward.findMany({
    where: {
      awardGroup: "WINNERS",
      awardCode: { in: ["WD", "WB"] },
      dogsInCompetition: { not: null },
      showDay: { cluster: { year: args.sourceYear } },
    },
    select: {
      id: true,
      showDayId: true,
      breedCode2: true,
      awardCode: true,
      dogsInCompetition: true,
      showDay: { select: { cluster: { select: { id: true, year: true, district: true } } } },
    },
    orderBy: { id: "asc" },
  });

  const observations: AnnualChampionshipCompetitionObservation[] = [];
  for (const award of awards) {
    if (
      isInvitationalClusterId(award.showDay.cluster.id) ||
      award.dogsInCompetition === null
    ) {
      continue;
    }
    const sex: Sex = award.awardCode === "WD" ? "M" : "F";
    observations.push({
      showAwardId: award.id,
      showDayId: award.showDayId,
      sourceYear: award.showDay.cluster.year,
      district: award.showDay.cluster.district,
      breedCode2: award.breedCode2,
      sex,
      dogsInCompetition: award.dogsInCompetition,
    });
  }
  return observations;
}
