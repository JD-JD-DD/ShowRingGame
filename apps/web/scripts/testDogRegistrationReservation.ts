import assert from "node:assert/strict";

import { isDogRegistrationCollision, reserveDogRegistrations } from "../server/services/dogRegistration.service";

const reservations = new Set<string>();
const client = {
  dogRegistrationReservation: {
    createMany: async ({ data }: { data: Array<{ regNumber: string }> }) => {
      if (data.some(({ regNumber }) => reservations.has(regNumber))) {
        throw { code: "P2002", meta: { target: ["regNumber"] } };
      }
      data.forEach(({ regNumber }) => reservations.add(regNumber));
      return { count: data.length };
    },
  },
};

async function main() {
  await reserveDogRegistrations(client as never, ["AB000000101"]);
  await reserveDogRegistrations(client as never, ["AB000000102", "AB000000103"]);
  assert.equal(reservations.size, 3, "sequential registrations reserve distinct full Dog numbers");
  await assert.rejects(() => reserveDogRegistrations(client as never, ["AB000000101"]), isDogRegistrationCollision, "deleting a Dog fixture cannot release its registration reservation");
  const concurrent = await Promise.allSettled(Array.from({ length: 12 }, () => reserveDogRegistrations(client as never, ["AB999999901"])));
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1, "concurrent allocation admits exactly one matching registration");
  await assert.rejects(() => reserveDogRegistrations(client as never, ["AB000000104", "AB000000104"]), /Unable to allocate a unique registration number/, "a litter batch cannot contain duplicate full registrations");
  console.log("Dog registration reservation checks passed.");
}

void main();
