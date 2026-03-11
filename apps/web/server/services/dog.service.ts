import { prisma } from "../../lib/prisma";
import { createFoundationDog, type Dog as EngineDog, type CreateFoundationDogInput } from "../../../../../packages/rules/engines/dog.engine";
import { DogLifecycleState, DogMarketState, DogOriginType, Sex } from "@prisma/client";

function epochHourToDate(epoch: number): Date {
  return new Date(epoch * 60 * 60 * 1000);
}

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
      return DogLifecycleState.ALIVE;
  }
}

async function getBreedIdByCode2(breedCode2: string): Promise<string> {
  const breed = await prisma.breed.findUnique({
    where: { code2: breedCode2 },
    select: { id: true },
  });

  if (!breed) {
    throw new Error(`Breed not found for code2: ${breedCode2}`);
  }

  return breed.id;
}

export async function saveEngineDog(args: {
  dog: EngineDog;
  currentKennelId?: string;
  bredByKennelId?: string;
  isFoundation?: boolean;
}) {
  const breedId = await getBreedIdByCode2(args.dog.breedCode2);

  return prisma.dog.create({
    data: {
      regNumber: args.dog.regNumber,
      breedId,
      currentKennelId: args.currentKennelId ?? null,
      bredByKennelId: args.bredByKennelId ?? null,
      sex: mapSex(args.dog.sex),
      birthAt: epochHourToDate(args.dog.birthEpoch),
      lifecycleState: mapLifecycleState(args.dog.status),
      marketState: DogMarketState.NOT_FOR_SALE,
      originType: args.isFoundation ? DogOriginType.FOUNDATION : DogOriginType.PLAYER_BRED,
      isFoundation: args.isFoundation ?? false,

      litterOrder: args.dog.litterOrder,
      traitHead: args.dog.traits.head,
      traitForequarters: args.dog.traits.forequarters,
      traitHindquarters: args.dog.traits.hindquarters,
      traitGait: args.dog.traits.gait,
      traitCoat: args.dog.traits.coat,
      traitSize: args.dog.traits.size,
      traitTemperament: args.dog.traits.temperament,
      traitShowShine: args.dog.traits.show_shine,
      traitFeet: args.dog.traits.feet,
      traitTopline: args.dog.traits.topline,

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