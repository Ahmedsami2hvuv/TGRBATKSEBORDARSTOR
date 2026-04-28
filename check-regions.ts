import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const count = await prisma.region.count()
  console.log('COUNT:' + count)
}
main().catch(console.error).finally(() => prisma.$disconnect())
