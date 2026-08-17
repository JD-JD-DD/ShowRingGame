import { TRAIT_KEYS, type TraitKey } from "../constants/genetics.constants";
import {
  isOrdinaryFoundationPhenotypePlausible,
  type FoundationPopulationContextInput,
} from "../engines/foundationDog.engine";
import type { DogTraits } from "../engines/dog.engine";

export type FoundationDiamondDiagnosticClass =
  | "ORDINARY_NEITHER"
  | "HIDDEN_GENETIC"
  | "DIRECTIONAL_PHENOTYPE"
  | "COMBINED"
  | "REPAIR_RISK";

/** Diagnostic-only GEN-09F attribution. It is never stored or exposed by production paths. */
export function classifyFoundationDiamondDiagnostic(input: {
  traits: DogTraits;
  populationContext: FoundationPopulationContextInput;
  observedOpportunityCount: number;
}): FoundationDiamondDiagnosticClass {
  if (input.observedOpportunityCount >= 3) return "REPAIR_RISK";
  const directional = isDirectionalPhenotypeDiamondDiagnostic(input);
  const genetic = input.observedOpportunityCount > 0;
  if (genetic && directional) return "COMBINED";
  if (genetic && isOrdinaryFoundationPhenotypeDiagnostic(input) && !directional) return "HIDDEN_GENETIC";
  if (directional) return "DIRECTIONAL_PHENOTYPE";
  return "ORDINARY_NEITHER";
}

export function isOrdinaryFoundationPhenotypeDiagnostic(input: {
  traits: DogTraits;
  populationContext: FoundationPopulationContextInput;
}): boolean {
  return isOrdinaryFoundationPhenotypePlausible(input) && TRAIT_KEYS.filter(trait => input.traits[trait] < 5 || input.traits[trait] > 15).length < 2;
}

export function isDirectionalPhenotypeDiamondDiagnostic(input: {
  traits: DogTraits;
  populationContext: FoundationPopulationContextInput;
}): boolean {
  if (!isOrdinaryFoundationPhenotypePlausible(input)) return false;
  const qualifying = TRAIT_KEYS.filter(trait => isDirectionalTraitDiagnostic(input, trait));
  if (qualifying.length !== 1) return false;
  return TRAIT_KEYS.filter(trait => trait !== qualifying[0]).every(trait => {
    const profile = input.populationContext.phenotypeContext.traits?.[trait]!;
    return Math.abs(input.traits[trait] - profile.center) <= 2 * Math.max(1, Math.sqrt(profile.variance));
  });
}

function isDirectionalTraitDiagnostic(input: { traits: DogTraits; populationContext: FoundationPopulationContextInput }, trait: TraitKey): boolean {
  const profile = input.populationContext.phenotypeContext.traits?.[trait];
  if (!profile) return false;
  const majorityAbove = profile.aboveShare >= .75 && profile.belowShare <= .25;
  const majorityBelow = profile.belowShare >= .75 && profile.aboveShare <= .25;
  if (!majorityAbove && !majorityBelow) return false;
  const value = input.traits[trait], scale = Math.max(1, Math.sqrt(profile.variance));
  const majorityCenter = majorityAbove ? profile.aboveCenter : profile.belowCenter;
  return (majorityAbove ? value < 10 : value > 10) && Math.abs(value - (majorityCenter ?? profile.center)) >= 3 * scale;
}
