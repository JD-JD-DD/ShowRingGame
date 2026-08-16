import type { Prisma } from "@prisma/client";

type RegistrationClient = Pick<Prisma.TransactionClient, "dogRegistrationReservation">;

/** Reserves final displayed Dog registrations transactionally; reservations are never recycled. */
export async function reserveDogRegistrations(
  client: RegistrationClient,
  regNumbers: readonly string[]
): Promise<void> {
  const unique = [...new Set(regNumbers)];
  if (unique.length !== regNumbers.length) {
    throw new Error("Unable to allocate a unique registration number.");
  }
  await client.dogRegistrationReservation.createMany({
    data: unique.map((regNumber) => ({ regNumber })),
  });
}

export function isDogRegistrationCollision(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
