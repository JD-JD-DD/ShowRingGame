import assert from "node:assert/strict";

import {
  adaptPublishedStudOfferToPublicStud,
  resolvePublicStudFromCandidates,
  type PublishedStudOfferPublicAdapterInput,
} from "@/server/services/publicStud.service";

function publishedOffer(
  overrides: Partial<PublishedStudOfferPublicAdapterInput> = {}
): PublishedStudOfferPublicAdapterInput {
  return {
    id: "offer-1",
    sireDogId: "sire-1",
    ownerKennelId: "kennel-1",
    version: 2,
    compensationType: "CASH",
    cashAmount: 500,
    puppyPickPosition: null,
    puppySex: null,
    brucellosisNegativeRequired: false,
    titleRequirement: "NONE",
    approvalMode: "AUTOMATIC",
    healthRequirements: [],
    sireDog: {
      id: "sire-1",
      ownerKennelId: "kennel-1",
      breedCode2: "PUG",
    },
    ...overrides,
  };
}

const studOfferOnly = resolvePublicStudFromCandidates({
  sireDogId: "sire-1",
  publishedOffers: [publishedOffer()],
});
assert.ok(studOfferOnly && studOfferOnly.source === "STUD_OFFER");
assert.equal(studOfferOnly.studOfferId, "offer-1");

assert.equal(resolvePublicStudFromCandidates({
  sireDogId: "sire-1",
  publishedOffers: [],
}), null);

const staleOffer = publishedOffer({
  sireDog: { id: "sire-1", ownerKennelId: "other-kennel", breedCode2: "PUG" },
});
assert.equal(adaptPublishedStudOfferToPublicStud(staleOffer), null);
assert.equal(
  resolvePublicStudFromCandidates({
    sireDogId: "sire-1",
    publishedOffers: [staleOffer],
  }),
  null
);

const puppyBack = adaptPublishedStudOfferToPublicStud(
  publishedOffer({
    compensationType: "PUPPY_BACK",
    cashAmount: null,
    puppyPickPosition: "FIRST",
    puppySex: "FEMALE",
  })
);
assert.equal(puppyBack?.terms.cashAmount, null);
assert.equal(puppyBack?.terms.puppyBackSummary, "First Pick • Female");

const cashAndPuppyBack = adaptPublishedStudOfferToPublicStud(
  publishedOffer({
    compensationType: "CASH_AND_PUPPY_BACK",
    cashAmount: 750,
    puppyPickPosition: "SECOND",
    puppySex: "MALE",
  })
);
assert.equal(cashAndPuppyBack?.terms.cashAmount, 750);
assert.equal(cashAndPuppyBack?.terms.puppyBackSummary, "Second Pick • Male");

const structuredRequirements = adaptPublishedStudOfferToPublicStud(
  publishedOffer({
    brucellosisNegativeRequired: true,
    titleRequirement: "CH_OR_HIGHER",
    healthRequirements: [
      { healthTestCode: "HIP_DYSPLASIA", requirementLevel: "GREEN_ONLY" },
    ],
  })
);
assert.match(structuredRequirements?.terms.requirementsSummary ?? "", /Brucellosis negative/);
assert.match(structuredRequirements?.terms.requirementsSummary ?? "", /CH or higher/);
assert.match(structuredRequirements?.terms.requirementsSummary ?? "", /Green only/);

console.log("Public Stud offer-only resolver checks passed.");
