import { prisma } from "../apps/web/lib/prisma"

async function main() {
  const dogs = await prisma.dog.findMany()
  console.log("Dogs:", dogs.length)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
  