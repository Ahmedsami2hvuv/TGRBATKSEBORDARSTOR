import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const employees = await prisma.staffEmployee.findMany({
    select: {
      id: true,
      name: true,
      active: true
    }
  });
  console.log("Employees in New Database:", JSON.stringify(employees, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
