import type { ShowEntryAbsenceReason, ShowEntryStatus } from "@prisma/client";
import type { CanonicalShowGroupCode } from "@showring/rules";

type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

/**
 * Canonical server-facing read model for the future My Results hierarchy.
 *
 * Inclusion is historical: every node is present only when it contains at
 * least one qualifying ShowEntry whose persisted kennelId is the requesting
 * kennel. Current Dog ownership and lifecycle never determine inclusion.
 * Empty child arrays are not valid output from the hierarchy builder.
 */
export type MyResultsHierarchy = readonly MyResultsCluster[];

export type MyResultsCluster = {
  id: string;
  name: string;
  district: number | null;
  districtRegionName: string;
  /** The maximum scheduledEpoch of this cluster's included showDays. */
  mostRecentShowDayEpoch: number;
  showDays: NonEmptyReadonlyArray<MyResultsShowDay>;
};

export type MyResultsShowDay = {
  id: string;
  dayIndex: number | null;
  scheduledEpoch: number;
  /** ShowDay.judge is the current application's BIS display authority. */
  bisJudge: MyResultsJudge | null;
  groups: NonEmptyReadonlyArray<MyResultsGroup>;
};

export type MyResultsGroup = {
  code: CanonicalShowGroupCode;
  name: string;
  /**
   * The historical group/breed judging identity for this group. Actual
   * persisted judging attribution wins; a scheduled group assignment is only
   * a fallback for rows without persisted judging attribution.
   */
  judge: MyResultsJudgeAttribution | null;
  breeds: NonEmptyReadonlyArray<MyResultsBreed>;
};

export type MyResultsBreed = {
  code2: string;
  name: string;
  dogResults: NonEmptyReadonlyArray<MyResultsDogResult>;
};

export type MyResultsDogResult = {
  showEntryId: string;
  dogId: string;
  dogDisplayName: string;
  registrationNumber: string;
  entryStatus: ShowEntryStatus;
  absenceReason: ShowEntryAbsenceReason | null;
  /** Null represents a qualifying entry with no persisted ShowResult. */
  result: MyResultsStoredResult | null;
  /**
   * Actual breed judging attribution for this entry when persisted; otherwise
   * the same scheduled-group fallback used by its parent group.
   */
  breedJudge: MyResultsJudgeAttribution | null;
};

export type MyResultsStoredResult = {
  awardCodes: readonly string[];
  championshipPointsAwarded: number;
  isChampionshipMajor: boolean;
  /** Stored per-award credits; aggregate/display with buildTitlePointsDisplay. */
  grandChampionCredits: readonly MyResultsGrandChampionCredit[];
};

export type MyResultsGrandChampionCredit = {
  pointsAwarded: number;
  isMajor: boolean;
};

export type MyResultsJudge = {
  name: string;
  judgeCode: string;
};

/**
 * Source precedence is SHOW_RESULT, SHOW_JUDGING_BLOCK, then
 * SCHEDULED_GROUP_ASSIGNMENT. An award's judge remains authoritative only for
 * that award; it does not replace the breed-result judge in this contract.
 */
export type MyResultsJudgeAttribution = {
  judge: MyResultsJudge;
  source:
    | "SHOW_RESULT"
    | "SHOW_JUDGING_BLOCK"
    | "SCHEDULED_GROUP_ASSIGNMENT";
};

/**
 * Required output ordering: clusters by mostRecentShowDayEpoch descending;
 * show days by scheduledEpoch ascending; groups by canonical group order;
 * breeds by name ascending; dog results by dogDisplayName ascending, then
 * registrationNumber ascending, then showEntryId ascending.
 */
export const MY_RESULTS_HIERARCHY_ORDERING = {
  clusters: "mostRecentShowDayEpoch:desc",
  showDays: "scheduledEpoch:asc",
  groups: "canonical-show-group-order",
  breeds: "name:asc",
  dogResults: "dogDisplayName:asc,registrationNumber:asc,showEntryId:asc",
} as const;
