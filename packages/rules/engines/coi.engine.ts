import { COI_CALCULATION_MAX_GENERATIONS } from "../constants/genetics.constants";

export type PedigreeDog = {
  id: string;
  sireId: string | null;
  damId: string | null;
};

export type CalculatePedigreeCoiInput = {
  sireId: string;
  damId: string;
  pedigree: PedigreeDog[];
  maxGenerations?: number;
};

export type PedigreeCoi = {
  coiPercent: number;
  generationDepth: number;
};

function assertMaxGenerations(maxGenerations: number): void {
  if (!Number.isInteger(maxGenerations) || maxGenerations < 1) {
    throw new Error("maxGenerations must be a positive integer.");
  }
}

function getReachablePedigree(
  sireId: string,
  damId: string,
  pedigreeById: Map<string, PedigreeDog>,
  maxGenerations: number
): { reachableIds: Set<string>; generationDepth: number } {
  const reachableIds = new Set<string>();
  let currentIds = new Set([sireId, damId]);
  let generationDepth = 0;

  for (let generation = 1; generation <= maxGenerations; generation += 1) {
    const nextIds = new Set<string>();
    let foundDog = false;

    for (const dogId of currentIds) {
      const dog = pedigreeById.get(dogId);

      if (!dog) continue;

      foundDog = true;
      reachableIds.add(dog.id);

      if (dog.sireId && !reachableIds.has(dog.sireId)) {
        nextIds.add(dog.sireId);
      }

      if (dog.damId && !reachableIds.has(dog.damId)) {
        nextIds.add(dog.damId);
      }
    }

    if (!foundDog) break;

    generationDepth = generation;
    currentIds = nextIds;

    if (currentIds.size === 0) break;
  }

  return { reachableIds, generationDepth };
}

function getAncestorFirstOrder(
  reachableIds: Set<string>,
  pedigreeById: Map<string, PedigreeDog>
): PedigreeDog[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: PedigreeDog[] = [];

  function visit(dogId: string): void {
    if (!reachableIds.has(dogId) || visited.has(dogId)) return;

    if (visiting.has(dogId)) {
      throw new Error("Pedigree contains a cycle.");
    }

    const dog = pedigreeById.get(dogId);
    if (!dog) return;

    visiting.add(dogId);

    if (dog.sireId) visit(dog.sireId);
    if (dog.damId) visit(dog.damId);

    visiting.delete(dogId);
    visited.add(dogId);
    ordered.push(dog);
  }

  for (const dogId of reachableIds) {
    visit(dogId);
  }

  return ordered;
}

function roundPercent(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Calculates Wright's pedigree COI with a tabular additive relationship matrix.
 * Missing ancestors at the configured generation limit are treated as founders.
 */
export function calculatePedigreeCoi(
  input: CalculatePedigreeCoiInput
): PedigreeCoi {
  const maxGenerations =
    input.maxGenerations ?? COI_CALCULATION_MAX_GENERATIONS;
  assertMaxGenerations(maxGenerations);

  const pedigreeById = new Map(input.pedigree.map((dog) => [dog.id, dog]));
  const { reachableIds, generationDepth } = getReachablePedigree(
    input.sireId,
    input.damId,
    pedigreeById,
    maxGenerations
  );
  const ordered = getAncestorFirstOrder(reachableIds, pedigreeById);
  const indexById = new Map(ordered.map((dog, index) => [dog.id, index]));
  const relationships = ordered.map(() => ordered.map(() => 0));

  for (let dogIndex = 0; dogIndex < ordered.length; dogIndex += 1) {
    const dog = ordered[dogIndex];
    const sireIndex = dog.sireId ? indexById.get(dog.sireId) : undefined;
    const damIndex = dog.damId ? indexById.get(dog.damId) : undefined;

    for (let otherIndex = 0; otherIndex < dogIndex; otherIndex += 1) {
      const sireRelationship =
        sireIndex === undefined ? 0 : relationships[sireIndex][otherIndex];
      const damRelationship =
        damIndex === undefined ? 0 : relationships[damIndex][otherIndex];
      const relationship = (sireRelationship + damRelationship) / 2;

      relationships[dogIndex][otherIndex] = relationship;
      relationships[otherIndex][dogIndex] = relationship;
    }

    const parentRelationship =
      sireIndex === undefined || damIndex === undefined
        ? 0
        : relationships[sireIndex][damIndex];
    relationships[dogIndex][dogIndex] = 1 + parentRelationship / 2;
  }

  const sireIndex = indexById.get(input.sireId);
  const damIndex = indexById.get(input.damId);
  const parentRelationship =
    sireIndex === undefined || damIndex === undefined
      ? 0
      : relationships[sireIndex][damIndex];

  return {
    coiPercent: roundPercent((parentRelationship / 2) * 100),
    generationDepth,
  };
}
