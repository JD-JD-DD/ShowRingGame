export type ReproductiveEmergencyPresentationInput = {
  status: "PENDING" | "TREATMENT_AUTHORIZED" | "RESOLVED_TREATED" | "RESOLVED_UNTREATED";
  intendedPuppyCount: number;
  survivingPuppyCount: number | null;
  damOutcome: "SURVIVED" | "DIED" | null;
  reproductiveConsequence: "NONE" | "EXTENDED_RECOVERY" | "PERMANENT_BREEDING_RESTRICTION" | null;
  recoveryUntilEpoch: number | null;
  litterId: string | null;
};

export function getReproductiveEmergencyPresentation(event: ReproductiveEmergencyPresentationInput) {
  const survived = event.survivingPuppyCount;
  const puppyOutcome = survived === null ? null : survived === 0
    ? `None of the ${event.intendedPuppyCount} puppies survived the whelping emergency.`
    : survived === event.intendedPuppyCount
      ? `All ${event.intendedPuppyCount} puppies survived the whelping emergency.`
      : `${survived} of ${event.intendedPuppyCount} puppies survived the whelping emergency.`;
  const consequence = event.damOutcome === "DIED" ? null
    : event.reproductiveConsequence === "EXTENDED_RECOVERY"
      ? "She requires an extended recovery before she may be bred again."
      : event.reproductiveConsequence === "PERMANENT_BREEDING_RESTRICTION"
        ? "Veterinary complications mean she cannot safely carry another litter and may not be bred again."
        : event.reproductiveConsequence === "NONE"
          ? "She has no lasting reproductive restriction and will complete the normal post-whelp recovery."
          : null;
  return {
    statusLabel: event.status === "PENDING" ? "Pending care" : event.status === "TREATMENT_AUTHORIZED" ? "Emergency treatment authorized" : "Resolved",
    treatmentLabel: event.status === "RESOLVED_UNTREATED" ? "The emergency-care deadline passed before treatment was authorized." : event.status === "PENDING" ? "Treatment decision pending" : "Emergency treatment was authorized.",
    damOutcomeLabel: event.damOutcome === "SURVIVED" ? "Dam survived" : event.damOutcome === "DIED" ? "Dam died" : null,
    puppyOutcome,
    consequenceMessage: consequence,
    recoveryUntilLabel: event.recoveryUntilEpoch === null ? null : formatUtcDateTime(event.recoveryUntilEpoch),
    litterHref: event.litterId ? `/litters/${event.litterId}` : null,
  };
}
import { formatUtcDateTime } from "@/lib/gameTimeFormat";
