import { prisma } from "../../lib/prisma";
import {
  createFoundationDog,
  type Dog as EngineDog,
  type CreateFoundationDogInput,
} from ",,/,,/,,/,,/../engines/dog.engine.ts";
import {
  DogLifecycleState,
  DogMarketState,
  DogOriginType,
  Sex,
} from "@prisma/client";

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
      return DogLifecycleState.SOLD;
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
  const breed = await prisma.breed.findUnique({
    where: { code2: breedCode2 },
    select: { code2: true },
  });

  if (!breed) {
    throw new Error(`Breed not found for code2: ${breedCode2}`);
  }
}

export async function saveEngineDog(args: {
  dog: EngineDog;
  currentKennelId?: string;
  bredByKennelId?: string;
  isFoundation?: boolean;
}) {
  const { dog, currentKennelId, bredByKennelId, isFoundation } = args;

  await ensureBreedExists(dog.breedCode2);

  return prisma.dog.create({
    data: {
      id: dog.dogId,
      regNumber: dog.regNumber,
      breedCode2: dog.breedCode2,
      currentKennelId: currentKennelId ?? null,
      bredByKennelId: bredByKennelId ?? null,
      sireId: dog.sireId ?? null,
      damId: dog.damId ?? null,
      litterId: dog.litterId ?? null,
      litterOrder: dog.litterOrder ?? null,
      sex: mapSex(dog.sex),
      birthEpoch: dog.birthEpoch,
      deathEpoch: null,
      lifecycleState: mapLifecycleState(dog.status),
      marketState: DogMarketState.NOT_FOR_SALE,
      originType: mapOriginType(isFoundation),
      isFoundation: isFoundation ?? false,
      coiPercent: null,
      coiGenerationDepth: null,
      visibleTitlePrefix: null,
      visibleTitleSuffix: null,
      notesPublic: null,

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

      ringObedience: 0,
      muscleTone: 0,
      coatCondition: 0,
      fatiguePoints: 0,
    },
  });
}

export async function createFoundationDogInDb(args: {
  engineInput: CreateFoundationDogInput;
  currentKennelId?: string;
  bredByKennelId?: string;
}) {
  const dog = createFoundationDog(args.engineInput);

  return saveEngineDog({
    dog,
    currentKennelId: args.currentKennelId,
    bredByKennelId: args.bredByKennelId,
    isFoundation: true,
  });
}