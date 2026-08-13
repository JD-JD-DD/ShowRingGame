export type SearchableKennelDog = {
  callName: string | null;
  registeredName: string | null;
  regNumber: string;
};

export function matchesKennelDogSearch(
  dog: SearchableKennelDog,
  normalizedQuery: string
): boolean {
  return (
    !normalizedQuery ||
    [dog.callName, dog.registeredName, dog.regNumber].some((value) =>
      value?.toLowerCase().includes(normalizedQuery)
    )
  );
}
