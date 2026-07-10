export const REGULAR_RIBBON_ASSETS = {
  BIS: "/awards/ribbons/regular/best-in-show.svg",
  RBIS: "/awards/ribbons/regular/reserve-best-in-show.svg",
  G1: "/awards/ribbons/regular/group-first.svg",
  G2: "/awards/ribbons/regular/group-second.svg",
  G3: "/awards/ribbons/regular/group-third.svg",
  G4: "/awards/ribbons/regular/group-fourth.svg",
  BOB: "/awards/ribbons/regular/best-of-breed.svg",
  BOS: "/awards/ribbons/regular/best-of-opposite-sex.svg",
  SELECT_DOG: "/awards/ribbons/regular/select.svg",
  SELECT_BITCH: "/awards/ribbons/regular/select.svg",
} as const;

export const INVITATIONAL_RIBBON_ASSETS = {
  BIS: "/awards/ribbons/invitational/best-in-show.svg",
  RBIS: "/awards/ribbons/invitational/reserve-best-in-show.svg",
  G1: "/awards/ribbons/invitational/group-first.svg",
  G2: "/awards/ribbons/invitational/group-second.svg",
  G3: "/awards/ribbons/invitational/group-third.svg",
  G4: "/awards/ribbons/invitational/group-fourth.svg",
  BOB: "/awards/ribbons/invitational/best-of-breed.svg",
  BOS: "/awards/ribbons/invitational/best-of-opposite-sex.svg",
  SELECT_DOG: "/awards/ribbons/invitational/select.svg",
  SELECT_BITCH: "/awards/ribbons/invitational/select.svg",
} as const;

export type RegularRibbonAwardCode = keyof typeof REGULAR_RIBBON_ASSETS;
export type InvitationalRibbonAwardCode =
  keyof typeof INVITATIONAL_RIBBON_ASSETS;
