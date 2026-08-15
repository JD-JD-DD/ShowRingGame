import type { DogTraits } from "@showring/rules";

export type PersistedPhenotypeValue = number | { toNumber(): number };

export type PersistedDogTraitRecord = {
  traitHead: PersistedPhenotypeValue;
  traitForequarters: PersistedPhenotypeValue;
  traitHindquarters: PersistedPhenotypeValue;
  traitGait: PersistedPhenotypeValue;
  traitCoat: PersistedPhenotypeValue;
  traitSize: PersistedPhenotypeValue;
  traitTemperament: PersistedPhenotypeValue;
  traitShowShine: PersistedPhenotypeValue;
  traitFeet: PersistedPhenotypeValue;
  traitTopline: PersistedPhenotypeValue;
};

const PHENOTYPE_MIN = 0;
const PHENOTYPE_MAX = 20;
const PHENOTYPE_MICRO_UNITS = 1_000_000;
const PRECISION_EPSILON = 1e-12;

/** Converts Prisma Decimal values to the number-based current rules boundary. */
export function toGameplayPhenotype(value: PersistedPhenotypeValue): number {
  const numeric = typeof value === "number" ? value : value.toNumber();
  if (!Number.isFinite(numeric) || numeric < PHENOTYPE_MIN || numeric > PHENOTYPE_MAX) {
    throw new Error("Persisted phenotype must be a finite value within 0..20.");
  }
  const microUnits = Math.round(numeric * PHENOTYPE_MICRO_UNITS);
  if (Math.abs(numeric - microUnits / PHENOTYPE_MICRO_UNITS) > PRECISION_EPSILON) {
    throw new Error("Persisted phenotype supports no more than six decimal places.");
  }
  return microUnits / PHENOTYPE_MICRO_UNITS;
}

export function toRulesDogTraits(dog: PersistedDogTraitRecord): DogTraits {
  return {
    head: toGameplayPhenotype(dog.traitHead),
    forequarters: toGameplayPhenotype(dog.traitForequarters),
    hindquarters: toGameplayPhenotype(dog.traitHindquarters),
    gait: toGameplayPhenotype(dog.traitGait),
    coat: toGameplayPhenotype(dog.traitCoat),
    size: toGameplayPhenotype(dog.traitSize),
    temperament: toGameplayPhenotype(dog.traitTemperament),
    show_shine: toGameplayPhenotype(dog.traitShowShine),
    feet: toGameplayPhenotype(dog.traitFeet),
    topline: toGameplayPhenotype(dog.traitTopline),
  };
}

/** Validates current rules output before it crosses into Decimal persistence. */
export function toPersistedDogTraits(traits: DogTraits) {
  return {
    traitHead: toGameplayPhenotype(traits.head),
    traitForequarters: toGameplayPhenotype(traits.forequarters),
    traitHindquarters: toGameplayPhenotype(traits.hindquarters),
    traitGait: toGameplayPhenotype(traits.gait),
    traitCoat: toGameplayPhenotype(traits.coat),
    traitSize: toGameplayPhenotype(traits.size),
    traitTemperament: toGameplayPhenotype(traits.temperament),
    traitShowShine: toGameplayPhenotype(traits.show_shine),
    traitFeet: toGameplayPhenotype(traits.feet),
    traitTopline: toGameplayPhenotype(traits.topline),
  };
}
