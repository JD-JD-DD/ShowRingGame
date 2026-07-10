import type {
  RibbonRoomAwardCode,
  RibbonRoomInvitationalStatus,
  RibbonRoomMilestoneType,
} from "@/server/services/ribbonRoom.service";

import {
  INVITATIONAL_RIBBON_ASSETS,
  REGULAR_RIBBON_ASSETS,
} from "@/lib/awards/ribbonAssets";

export const RIBBON_TOTAL_ORDER = [
  "BIS",
  "RBIS",
  "G1",
  "G2",
  "G3",
  "G4",
  "BOB",
  "BOS",
  "SELECT",
] as const satisfies readonly RibbonRoomAwardCode[];

export const RIBBON_LABELS: Record<RibbonRoomAwardCode, string> = {
  BIS: "Best in Show",
  RBIS: "Reserve Best in Show",
  G1: "Group First",
  G2: "Group Second",
  G3: "Group Third",
  G4: "Group Fourth",
  BOB: "Best of Breed",
  BOS: "Best of Opposite Sex",
  SELECT: "Select",
};

export const INVITATIONAL_STATUS_LABELS: Record<
  RibbonRoomInvitationalStatus,
  string
> = {
  INVITED: "Invited",
  BEST_IN_SHOW: "Best in Show",
  RESERVE_BEST_IN_SHOW: "Reserve Best in Show",
  GROUP_FIRST: "Group First",
  GROUP_SECOND: "Group Second",
  GROUP_THIRD: "Group Third",
  GROUP_FOURTH: "Group Fourth",
  BEST_OF_BREED: "Best of Breed",
  BEST_OF_OPPOSITE_SEX: "Best of Opposite Sex",
  SELECT: "Select",
};

export const MILESTONE_LABELS: Record<RibbonRoomMilestoneType, string> = {
  FIRST_ENTRY: "First Show Entry",
  FIRST_RIBBON: "First Ribbon",
  FIRST_BOB: "First Best of Breed",
  FIRST_BOS: "First Best of Opposite Sex",
  FIRST_SELECT: "First Select",
  FIRST_GROUP: "First Group Placement",
  FIRST_G1: "First Group First",
  FIRST_RBIS: "First Reserve Best in Show",
  FIRST_BIS: "First Best in Show",
  CHAMPION: "Champion Completed",
  GRAND_CHAMPION: "Grand Champion Completed",
  FIRST_INVITATIONAL_QUALIFICATION: "First Invitational Qualification",
  FIRST_INVITATIONAL_PLACEMENT: "First Invitational Placement",
};

export function getRegularRibbonAssetPath(award: RibbonRoomAwardCode): string {
  switch (award) {
    case "BIS":
      return REGULAR_RIBBON_ASSETS.BIS;
    case "RBIS":
      return REGULAR_RIBBON_ASSETS.RBIS;
    case "G1":
      return REGULAR_RIBBON_ASSETS.G1;
    case "G2":
      return REGULAR_RIBBON_ASSETS.G2;
    case "G3":
      return REGULAR_RIBBON_ASSETS.G3;
    case "G4":
      return REGULAR_RIBBON_ASSETS.G4;
    case "BOB":
      return REGULAR_RIBBON_ASSETS.BOB;
    case "BOS":
      return REGULAR_RIBBON_ASSETS.BOS;
    case "SELECT":
      return REGULAR_RIBBON_ASSETS.SELECT_DOG;
  }
}

export function getInvitationalRibbonAssetPath(
  status: RibbonRoomInvitationalStatus
): string | null {
  switch (status) {
    case "BEST_IN_SHOW":
      return INVITATIONAL_RIBBON_ASSETS.BIS;
    case "RESERVE_BEST_IN_SHOW":
      return INVITATIONAL_RIBBON_ASSETS.RBIS;
    case "GROUP_FIRST":
      return INVITATIONAL_RIBBON_ASSETS.G1;
    case "GROUP_SECOND":
      return INVITATIONAL_RIBBON_ASSETS.G2;
    case "GROUP_THIRD":
      return INVITATIONAL_RIBBON_ASSETS.G3;
    case "GROUP_FOURTH":
      return INVITATIONAL_RIBBON_ASSETS.G4;
    case "BEST_OF_BREED":
      return INVITATIONAL_RIBBON_ASSETS.BOB;
    case "BEST_OF_OPPOSITE_SEX":
      return INVITATIONAL_RIBBON_ASSETS.BOS;
    case "SELECT":
      return INVITATIONAL_RIBBON_ASSETS.SELECT_DOG;
    case "INVITED":
      return null;
  }
}

export function milestoneTone(type: RibbonRoomMilestoneType): string {
  if (type === "CHAMPION" || type === "GRAND_CHAMPION") {
    return "premium";
  }

  if (
    type === "FIRST_BIS" ||
    type === "FIRST_INVITATIONAL_QUALIFICATION" ||
    type === "FIRST_INVITATIONAL_PLACEMENT"
  ) {
    return "featured";
  }

  return "standard";
}
