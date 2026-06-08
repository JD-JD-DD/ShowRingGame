export type BreedSelectOption = {
  code2: string;
  name: string;
  groupName?: string | null;
};

export type BreedSelectGroup<Option extends BreedSelectOption> = {
  groupName: string;
  options: Option[];
};

const BREED_GROUP_ORDER = [
  "Sporting",
  "Hound",
  "Working",
  "Terrier",
  "Toy",
  "Non-Sporting",
  "Herding",
  "Misc",
];

const BREED_GROUP_ORDER_INDEX = new Map(
  BREED_GROUP_ORDER.map((groupName, index) => [groupName, index])
);

export function normalizeBreedGroupName(groupName?: string | null): string {
  const normalized = groupName?.trim();

  if (!normalized || normalized === "Miscellaneous") {
    return "Misc";
  }

  return normalized;
}

export function compareBreedGroupNames(a: string, b: string): number {
  const orderA = BREED_GROUP_ORDER_INDEX.get(a);
  const orderB = BREED_GROUP_ORDER_INDEX.get(b);

  if (orderA != null && orderB != null) {
    return orderA - orderB;
  }

  if (orderA != null) {
    return -1;
  }

  if (orderB != null) {
    return 1;
  }

  return a.localeCompare(b);
}

export function compareBreedOptions(
  a: Pick<BreedSelectOption, "name" | "code2">,
  b: Pick<BreedSelectOption, "name" | "code2">
): number {
  return a.name.localeCompare(b.name) || a.code2.localeCompare(b.code2);
}

export function groupBreedOptions<Option extends BreedSelectOption>(
  options: Option[]
): Array<BreedSelectGroup<Option>> {
  const groups = new Map<string, Option[]>();

  for (const option of options) {
    const groupName = normalizeBreedGroupName(option.groupName);
    const groupOptions = groups.get(groupName) ?? [];
    groupOptions.push(option);
    groups.set(groupName, groupOptions);
  }

  return [...groups.entries()]
    .sort(([groupA], [groupB]) => compareBreedGroupNames(groupA, groupB))
    .map(([groupName, groupOptions]) => ({
      groupName,
      options: [...groupOptions].sort(compareBreedOptions),
    }));
}

export function BreedSelectOptions<Option extends BreedSelectOption>({
  options,
  getLabel,
}: {
  options: Option[];
  getLabel?: (option: Option) => string;
}) {
  return (
    <>
      {groupBreedOptions(options).map((group) => (
        <optgroup key={group.groupName} label={`-- ${group.groupName} --`}>
          {group.options.map((option) => (
            <option key={option.code2} value={option.code2}>
              {getLabel ? getLabel(option) : option.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
