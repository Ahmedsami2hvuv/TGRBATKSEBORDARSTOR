import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const branches = await prisma.storeBranch.findMany({
    select: {
      id: true,
      name: true,
      profitMargin: true,
      category: { select: { name: true } }
    }
  })
  console.log('Branches Margins:')
  for (const b of branches) {
    if (Number(b.profitMargin) !== 0) {
      console.log(`Branch: "${b.name}" in category "${b.category?.name || 'N/A'}" has profitMargin = ${b.profitMargin}`)
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
