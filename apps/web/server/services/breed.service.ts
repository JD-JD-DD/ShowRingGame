import { db } from "@/lib/db";
import {
  CANONICAL_SHOW_GROUP_CODES,
  CURRENT_BREED_RELEASE,
  isCanonicalShowGroupCode,
  resolveBreedGroupNameToCanonicalShowGroupCode,
  type CanonicalShowGroupCode,
} from "@showring/rules";

type ReleasedBreedCatalogRow = {
  code2: string;
  name: string;
  groupName: string | null;
};

type BreedCatalogClient = Pick<typeof db, "breed">;

export type ReleasedBreedGroup = {
  groupCode: CanonicalShowGroupCode;
  breeds: Array<{
    code2: string;
    name: string;
  }>;
};

async function listReleasedBreedCatalogRows(
  client: BreedCatalogClient = db
): Promise<ReleasedBreedCatalogRow[]> {
  return client.breed.findMany({
    where: {
      isActive: true,
      releaseVersion: {
        lte: CURRENT_BREED_RELEASE,
      },
    },
    orderBy: [{ groupName: "asc" }, { name: "asc" }, { code2: "asc" }],
    select: {
      code2: true,
      name: true,
      groupName: true,
    },
  });
}

/**
 * Groups the released breed catalog by the canonical internal show-group IDs
 * used by scheduled judging. Empty canonical groups remain explicit so future
 * workers can distinguish an empty group from an absent discovery result.
 */
export function groupReleasedBreedsByCanonicalShowGroup(
  breeds: ReleasedBreedCatalogRow[]
): ReleasedBreedGroup[] {
  const breedsByGroup = new Map<
    CanonicalShowGroupCode,
    ReleasedBreedGroup["breeds"]
  >(CANONICAL_SHOW_GROUP_CODES.map((groupCode) => [groupCode, []]));
  const seenBreedCodes = new Set<string>();

  for (const breed of breeds) {
    if (seenBreedCodes.has(breed.code2)) {
      throw new Error(`Released breed catalog contains duplicate code: ${breed.code2}.`);
    }
    seenBreedCodes.add(breed.code2);

    const groupCode = resolveBreedGroupNameToCanonicalShowGroupCode(
      breed.groupName
    );

    if (!isCanonicalShowGroupCode(groupCode)) {
      throw new Error(
        `Released breed ${breed.code2} has a non-scheduled group: ${groupCode}.`
      );
    }

    breedsByGroup.get(groupCode)!.push({
      code2: breed.code2,
      name: breed.name,
    });
  }

  return CANONICAL_SHOW_GROUP_CODES.map((groupCode) => ({
    groupCode,
    breeds: (breedsByGroup.get(groupCode) ?? []).sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.code2.localeCompare(right.code2)
    ),
  }));
}

export async function getReleasedBreedsGroupedByCanonicalShowGroup(
  client: BreedCatalogClient = db
): Promise<ReleasedBreedGroup[]> {
  return groupReleasedBreedsByCanonicalShowGroup(
    await listReleasedBreedCatalogRows(client)
  );
}

export async function getReleasedBreedCodes(): Promise<string[]> {
  const breeds = await listReleasedBreedCatalogRows();

  return breeds.map((breed) => breed.code2);
}
