import { strict as assert } from "node:assert";

import { MIN_SHOW_AGE_HOURS } from "@showring/rules";

import {
  GROOMING_WEEK_HOURS,
  applyMissedGroomingDecayForDueDogs,
} from "@/server/services/grooming.service";

type FakeConditionEvent = {
  id?: string;
  dogId: string;
  actorKennelId?: string | null;
  ownerKennelIdAtEvent?: string | null;
  eventType: "GROOMING_GAIN" | "MISSED_GROOMING_DECAY";
  amount: number;
  conditionBefore?: number;
  conditionAfter?: number;
  groomingWeek: number;
  occurredAtEpoch?: number;
  decayKey?: string | null;
  note?: string | null;
};

type FakeGroomingDecayClient = {
  dog: {
    findMany: () => Promise<
      Array<{
        id: string;
        birthEpoch: number;
        groomingServiceActions: [];
        conditionEvents: Array<{
          eventType: FakeConditionEvent["eventType"];
          amount: number;
          groomingWeek: number;
        }>;
      }>
    >;
    findUnique: () => Promise<{
      id: string;
      ownerKennelId: string;
      lifecycleState: string;
      visibilityState: string;
      isPlayerVisible: boolean;
      birthEpoch: number;
      coatCondition: number;
      healthConditionTruths: Array<never>;
      healthTests: Array<never>;
    }>;
    update: () => Promise<never>;
  };
  groomingServiceAction: {
    findFirst: () => Promise<null>;
  };
  dogConditionEvent: {
    findUnique: (args: { where: { decayKey: string } }) => Promise<{
      id: string;
    } | null>;
    groupBy: () => Promise<
      Array<{
        eventType: "GROOMING_GAIN";
        _sum: {
          amount: number;
        };
      }>
    >;
    create: (args: { data: FakeConditionEvent }) => Promise<FakeConditionEvent>;
  };
  $transaction: <T>(
    callback: (tx: FakeGroomingDecayClient) => Promise<T>
  ) => Promise<T>;
};

function createFakeGroomingDecayClient() {
  const dog = {
    id: "dog-no-positive-impact",
    ownerKennelId: "kennel-1",
    lifecycleState: "ALIVE",
    visibilityState: "VISIBLE",
    isPlayerVisible: true,
    birthEpoch: -MIN_SHOW_AGE_HOURS,
    coatCondition: 10,
    healthConditionTruths: [],
    healthTests: [],
  };
  const conditionEvents: FakeConditionEvent[] = [
    {
      id: "gain-1",
      dogId: dog.id,
      eventType: "GROOMING_GAIN",
      amount: 1,
      groomingWeek: 0,
      decayKey: null,
    },
  ];
  let dogUpdateCount = 0;

  const client: FakeGroomingDecayClient = {
    dog: {
      async findMany() {
        return [
          {
            id: dog.id,
            birthEpoch: dog.birthEpoch,
            groomingServiceActions: [],
            conditionEvents: conditionEvents.map((event) => ({
              eventType: event.eventType,
              amount: event.amount,
              groomingWeek: event.groomingWeek,
            })),
          },
        ];
      },
      async findUnique() {
        return { ...dog };
      },
      async update() {
        dogUpdateCount += 1;
        throw new Error("No-op grooming decay should not update coat condition.");
      },
    },
    groomingServiceAction: {
      async findFirst() {
        return null;
      },
    },
    dogConditionEvent: {
      async findUnique(args: { where: { decayKey: string } }) {
        const event = conditionEvents.find(
          (row) => row.decayKey === args.where.decayKey
        );

        return event ? { id: event.id ?? "condition-event" } : null;
      },
      async groupBy() {
        return [
          {
            eventType: "GROOMING_GAIN",
            _sum: {
              amount: 0,
            },
          },
        ];
      },
      async create(args: { data: FakeConditionEvent }) {
        const created = {
          id: `condition-event-${conditionEvents.length + 1}`,
          ...args.data,
        };
        conditionEvents.push(created);
        return created;
      },
    },
    async $transaction<T>(callback: (tx: typeof client) => Promise<T>) {
      return callback(client);
    },
  };

  return {
    client,
    conditionEvents,
    get dogUpdateCount() {
      return dogUpdateCount;
    },
  };
}

async function main() {
  const fake = createFakeGroomingDecayClient();
  const currentEpoch = GROOMING_WEEK_HOURS;
  const firstRun = await applyMissedGroomingDecayForDueDogs({
    currentEpoch,
    limit: 10,
    client: fake.client as never,
  });

  assert.equal(
    firstRun.checked,
    1,
    "no-positive-impact candidate is checked once"
  );
  assert.equal(firstRun.applied, 0, "no-op skip does not apply decay");
  assert.equal(firstRun.skipped, 1, "no-positive-impact candidate is skipped");
  assert.equal(
    firstRun.results[0]?.reason,
    "Dog has no positive grooming impact to decay.",
    "skip reason is preserved"
  );

  const noopEvents = fake.conditionEvents.filter(
    (event) => event.eventType === "MISSED_GROOMING_DECAY"
  );
  assert.equal(noopEvents.length, 1, "durable no-op marker is created");
  assert.equal(
    noopEvents[0]?.amount,
    0,
    "no-op marker does not reduce condition"
  );
  assert.equal(
    noopEvents[0]?.decayKey,
    "missed-grooming:dog-no-positive-impact:0",
    "no-op marker uses the dog/week decay idempotency key"
  );
  assert.equal(
    noopEvents[0]?.conditionBefore,
    noopEvents[0]?.conditionAfter,
    "no-op marker leaves coat condition unchanged"
  );
  assert.equal(fake.dogUpdateCount, 0, "no-op skip does not update the dog");
  assert.equal(firstRun.pendingCandidateCount, 0, "marker clears pending backlog");
  assert.equal(firstRun.hasMore, false, "no-op marker prevents more work");
  assert.equal(
    firstRun.caughtUp,
    true,
    "catch-up can complete after no-op marker"
  );

  const secondRun = await applyMissedGroomingDecayForDueDogs({
    currentEpoch,
    limit: 10,
    client: fake.client as never,
  });

  assert.equal(secondRun.checked, 0, "same candidate is not processed again");
  assert.equal(
    secondRun.pendingCandidateCount,
    0,
    "same candidate is not pending"
  );
  assert.equal(secondRun.hasMore, false, "second scan finds no remaining work");
  assert.equal(secondRun.caughtUp, true, "second run remains caught up");
  assert.equal(
    fake.conditionEvents.filter(
      (event) => event.eventType === "MISSED_GROOMING_DECAY"
    ).length,
    1,
    "no-op marker is not duplicated"
  );

  console.log("Grooming decay no-op catch-up checks passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
