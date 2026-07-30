import type { DogProfilePedigreeDogDto } from "@/server/mappers/dog.mapper";

const RELATIONSHIP_PARTS: Record<string, "S" | "D"> = {
  Sire: "S",
  Dam: "D",
};

export type PedigreeSlot = {
  position: string;
  relationshipLabel: string;
  generation: number;
  column: number;
  rowStart: number;
  rowSpan: number;
  ancestor: DogProfilePedigreeDogDto | null;
};

function positionForRelationship(relationship: string): string | null {
  const position = relationship
    .split("'s ")
    .map((part) => RELATIONSHIP_PARTS[part])
    .join("");

  return position.length > 0 && position.length <= 4 ? position : null;
}

function relationshipLabel(position: string): string {
  return position
    .split("")
    .map((part) => (part === "S" ? "Sire" : "Dam"))
    .join("'s ");
}

function positionsForGeneration(generation: number): string[] {
  if (generation === 0) return [""];

  return positionsForGeneration(generation - 1).flatMap((position) => [
    `${position}S`,
    `${position}D`,
  ]);
}

export function buildFourGenerationPedigreeSlots(
  ancestors: DogProfilePedigreeDogDto[]
): PedigreeSlot[] {
  const ancestorByPosition = new Map<string, DogProfilePedigreeDogDto>();

  for (const ancestor of ancestors) {
    const position = positionForRelationship(ancestor.relationship);
    if (position) ancestorByPosition.set(position, ancestor);
  }

  return [1, 2, 3, 4].flatMap((generation) => {
    const rowSpan = 2 ** (4 - generation);

    return positionsForGeneration(generation).map((position, index) => ({
      position,
      relationshipLabel: relationshipLabel(position),
      generation,
      column: generation,
      rowStart: index * rowSpan + 1,
      rowSpan,
      ancestor: ancestorByPosition.get(position) ?? null,
    }));
  });
}
