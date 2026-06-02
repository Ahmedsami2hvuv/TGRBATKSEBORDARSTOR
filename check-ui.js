const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const s = await prisma.uISystemSetting.findUnique({
    where: { target_section: { target: 'mandoub', section: 'order_details' } }
  });
  console.log(JSON.stringify(s, null, 2));
}
main().then(() => process.exit(0));
