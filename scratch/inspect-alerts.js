const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.staffEmployee.findMany({
    where: { active: true }
  });

  console.log("=== ACTIVE EMPLOYEES ===");
  console.log("Count:", employees.length);
  for (const emp of employees) {
    console.log(`ID: ${emp.id} | Name: ${emp.name} | Phone: ${emp.phone}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
