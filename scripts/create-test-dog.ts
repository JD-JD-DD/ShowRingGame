import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, DogOriginType, DogLifecycleState, DogMarketState, Sex } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create or reuse a breed
  const breed = await prisma.breed.upsert({
    where: { code2: "WV" },
    update: {},
    create: {
      code2: "WV",
      name: "Wirehaired Vizsla",
      groupName: "Sporting",
    },
  });

  // Create a kennel
  const kennel = await prisma.kennel.create({
    data: {
      name: "Valor Kennel",
      slug: "valor-kennel",
      isNpc: false,
      reputationScore: 0,
    },
  });

  // Create a dog
  const dog = await prisma.dog.create({
    data: {
      regNumber: "WV-TEST-0001",
      callName: "Scout",
      registeredName: "Valor's First Test Dog",
      breedId: breed.id,
      currentKennelId: kennel.id,
      sex: Sex.M,
      birthAt: new Date(),
      lifecycleState: DogLifecycleState.ALIVE,
      marketState: DogMarketState.NOT_FOR_SALE,
      originType: DogOriginType.FOUNDATION,
      isFoundation: true,

      traitHead: 12,
      traitForequarters: 11,
      traitHindquarters: 13,
      traitGait: 12,
      traitCoat: 10,
      traitSize: 11,
      traitTemperament: 13,
      traitShowShine: 12,
      traitFeet: 11,
      traitTopline: 12,

      ringObedience: 0,
      muscleTone: 0,
      coatCondition: 0,
      fatiguePoints: 0,
    },
  });

  console.log("Breed created/found:", breed);
  console.log("Kennel created:", kennel);
  console.log("Dog created:", dog);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });