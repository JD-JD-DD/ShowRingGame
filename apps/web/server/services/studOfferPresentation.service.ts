export function hasValidPublishedStudOffer(args: {
  ownerKennelId: string | null;
  publishedStudOffers: readonly { ownerKennelId: string }[];
}): boolean {
  return (
    args.ownerKennelId !== null &&
    args.publishedStudOffers.some(
      (offer) => offer.ownerKennelId === args.ownerKennelId
    )
  );
}
