import { db } from "@/lib/db";
import type { Dog as EngineDog } from "../../../../packages/rules/engines/dog.engine";
import { DogLifecycleState, DogMarketState, DogOriginType, Sex } from "@prisma/client";

function mapSex(sex: "M" | "F"): Sex {
  return sex === "M" ? Sex.M : Sex.F;
}

function mapLifecycleState(status: string): DogLifecycleState {
  switch (status) {
    case "ALIVE":
      return DogLifecycleState.ALIVE;
    case "DECEASED":
      return DogLifecycleState.DECEASED;
    case "SOLD":
      return DogLifecycleState.TRANSFERRED;
    case "TRANSFERRED":
      return DogLifecycleState.TRANSFERRED;
    case "RETIRED":
      return DogLifecycleState.RETIRED;
    default:
      throw new Error(`Unsupported dog lifecycle state: ${status}`);
  }
}

function mapOriginType(isFoundation?: boolean): DogOriginType {
  return isFoundation ? DogOriginType.FOUNDATION : DogOriginType.PLAYER_BRED;
}

async function ensureBreedExists(breedCode2: string): Promise<void> {
  const breed = await db.breed.findUnique({
    where: { code2: breedCode2 },
    select: { code2: true },
  });

  if (!breed) {
    throw new Error(`Breed not found for code2: ${breedCode2}`);
  }
}

export async function saveEngineDog(args: {
  dog: EngineDog;
  ownerKennelId?: string;
  breederKennelId?: string;
  isFoundation?: boolean;
}) {
  const { dog, ownerKennelId, breederKennelId, isFoundation } = args;

  await ensureBreedExists(dog.breedCode2);

  return db.dog.create({
    data: {
      id: dog.dogId,
      regNumber: dog.regNumber,
      callName: null,
      registeredName: null,
      breedCode2: dog.breedCode2,
      ownerKennelId: ownerKennelId ?? null,
      breederKennelId: breederKennelId ?? null,
      sireId: dog.sireId ?? null,
      damId: dog.damId ?? null,
      litterId: dog.litterId ?? null,
      litterOrder: dog.litterOrder ?? null,
      sex: mapSex(dog.sex),
      birthEpoch: dog.birthEpoch,
      lifecycleState: mapLifecycleState(dog.status),
      marketState: DogMarketState.NOT_FOR_SALE,
      originType: mapOriginType(isFoundation),
      isFoundation: isFoundation ?? false,

      traitHead: dog.traits.head,
      traitForequarters: dog.traits.forequarters,
      traitHindquarters: dog.traits.hindquarters,
      traitGait: dog.traits.gait,
      traitCoat: dog.traits.coat,
      traitSize: dog.traits.size,
      traitTemperament: dog.traits.temperament,
      traitShowShine: dog.traits.show_shine,
      traitFeet: dog.traits.feet,
      traitTopline: dog.traits.topline,
      
    },
  });
}

