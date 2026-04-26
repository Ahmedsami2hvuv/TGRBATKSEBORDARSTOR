import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const order = await prisma.order.findFirst({
    where: { submissionSource: 'web_store' },
    orderBy: { createdAt: 'desc' }
  })
  console.log('Last Web Store Order:', JSON.stringify(order, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
