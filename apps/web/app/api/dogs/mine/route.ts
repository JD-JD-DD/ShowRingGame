import { fail, ok } from "@/lib/http";
import { getCurrentEpoch } from "@/lib/gameClock";
import { getSessionUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { getKennelForUser } from "@/server/services/kennel.service";
import { deriveVisibleCategoriesFromTraits } from "../../../../../../packages/rules/engines/foundationDog.engine";

type MineDog = {
  id: string;
  callName: string | null;
  regNumber: string;
  breedCode2: string;
  sex: string;
  birthEpoch: number;
  marketState: string;
  originType: string;
  isFoundation: boolean;
  breed: {
    name: string;
  };
  traitHead: number;
  traitForequarters: number;
  traitHindquarters: number;
  traitGait: number;
  traitCoat: number;
  traitSize: number;
  traitTemperament: number;
  traitShowShine: number;
  traitFeet: number;
  traitTopline: number;
};

function toVisibleCategories(dog: MineDog) {
  return deriveVisibleCategoriesFromTraits({
    head: dog.traitHead,
    forequarters: dog.traitForequarters,
    hindquarters: dog.traitHindquarters,
    gait: dog.traitGait,
    coat: dog.traitCoat,
    size: dog.traitSize,
    temperament: dog.traitTemperament,
    show_shine: dog.traitShowShine,
    feet: dog.traitFeet,
    topline: dog.traitTopline,
  });
}

export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return fail("Unauthorized.", 401);
    }

    const kennel = await getKennelForUser(userId);

    if (!kennel) {
      return fail("Kennel not found.", 404);
    }

    const currentEpoch = getCurrentEpoch();

    const dogs: MineDog[] = await db.dog.findMany({
      where: {
        ownerKennelId: kennel.id,
        lifecycleState: "ALIVE",
      },
      orderBy: [{ birthEpoch: "desc" }],
      select: {
        id: true,
        callName: true,
        regNumber: true,
        breedCode2: true,
        sex: true,
        birthEpoch: true,
        marketState: true,
        originType: true,
        isFoundation: true,
        breed: {
          select: {
            name: true,
          },
        },
        traitHead: true,
        traitForequarters: true,
        traitHindquarters: true,
        traitGait: true,
        traitCoat: true,
        traitSize: true,
        traitTemperament: true,
        traitShowShine: true,
        traitFeet: true,
        traitTopline: true,
      },
    });

    return ok({
      kennel: {
        id: kennel.id,
        name: kennel.name,
        slug: kennel.slug,
        balance: kennel.balance,
        homeDistrict: kennel.homeDistrict,
        dogCount: dogs.length,
      },
      dogs: dogs.map((dog: MineDog) => ({
        dogId: dog.id,
        callName: dog.callName,
        regNumber: dog.regNumber,
        breedCode2: dog.breedCode2,
        breedName: dog.breed.name,
        sex: dog.sex,
        birthEpoch: dog.birthEpoch,
        ageHours: Math.max(0, currentEpoch - dog.birthEpoch),
        marketState: dog.marketState,
        originType: dog.originType,
        isFoundation: dog.isFoundation,
        visibleCategories: toVisibleCategories(dog),
      })),
    });
  } catch (error) {
    console.error("GET /api/dogs/mine failed", error);
    return fail("Unable to load kennel dogs.", 500);
  }
}
