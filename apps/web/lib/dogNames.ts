export type DogNameParts = {
  registeredName?: string | null;
  callName?: string | null;
  regNumber: string;
  visibleTitlePrefix?: string | null;
  visibleTitleSuffix?: string | null;
};

export function getBaseDogName(dog: DogNameParts): string {
  return dog.registeredName?.trim() || dog.callName?.trim() || dog.regNumber;
}

export function formatDogDisplayName(dog: DogNameParts): string {
  return [
    dog.visibleTitlePrefix?.trim(),
    getBaseDogName(dog),
    dog.visibleTitleSuffix?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
}
