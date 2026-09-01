import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  validateCallName,
  validateRegisteredDogName,
} from "@/server/validation/dogName.validation";

type DogNamingClient = Pick<Prisma.TransactionClient, "dog" | "breed">;

export class DogNamingError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

type DogNamingUpdate = {
  kennelId: string;
  dogId: string;
  callName?: FormDataEntryValue | string | null;
  registeredName?: FormDataEntryValue | string | null;
  client?: DogNamingClient;
};

async function updateDogNamingWithClient(
  client: DogNamingClient,
  args: Omit<DogNamingUpdate, "client">
) {
  const dog = await client.dog.findUnique({
    where: { id: args.dogId },
    select: { id: true, ownerKennelId: true, callName: true, registeredName: true },
  });

  if (!dog) {
    throw new DogNamingError("Dog not found.", 404);
  }

  if (dog.ownerKennelId !== args.kennelId) {
    throw new DogNamingError("You do not own this dog.", 403);
  }

  const callName =
    args.callName === undefined ? null : validateCallName(args.callName);
  if (callName && !callName.ok) {
    throw new DogNamingError(callName.error, 400);
  }

  let registeredName: string | null = null;
  if (args.registeredName !== undefined) {
    if (dog.registeredName?.trim()) {
      throw new DogNamingError("This dog has already been named.", 409);
    }

    const breeds = await client.breed.findMany({ select: { name: true } });
    const validation = validateRegisteredDogName(
      args.registeredName,
      breeds.map((breed) => breed.name)
    );
    if (!validation.ok) {
      throw new DogNamingError(validation.error, 400);
    }

    const existingDog = await client.dog.findFirst({
      where: {
        id: { not: args.dogId },
        registeredName: { equals: validation.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existingDog) {
      throw new DogNamingError("That dog name is already in use.", 409);
    }

    registeredName = validation.name;
  }

  if (!callName && registeredName === null) {
    return { callName: dog.callName, registeredName: dog.registeredName };
  }

  return client.dog.update({
    where: { id: args.dogId },
    data: {
      ...(callName ? { callName: callName.name || null } : {}),
      ...(registeredName !== null ? { registeredName } : {}),
    },
    select: { callName: true, registeredName: true },
  });
}

export async function updateDogNaming(args: DogNamingUpdate) {
  const { client, ...updateArgs } = args;

  if (client) {
    return updateDogNamingWithClient(client, updateArgs);
  }

  return db.$transaction((tx) => updateDogNamingWithClient(tx, updateArgs));
}
