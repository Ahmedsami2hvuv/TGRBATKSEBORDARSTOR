import { prisma } from "./src/lib/prisma";

async function main() {
  const couriers = await prisma.courier.findMany();
  const preparers = await prisma.companyPreparer.findMany();
  const employees = await prisma.employee.findMany();

  console.log("=== COURIERS ===");
  console.log(couriers.map(c => ({ id: c.id, name: c.name, phone: c.phone })));

  console.log("=== PREPARERS ===");
  console.log(preparers.map(p => ({ id: p.id, name: p.name, phone: p.phone, active: p.active })));

  console.log("=== EMPLOYEES ===");
  console.log(employees.map(e => ({ id: e.id, name: e.name, phone: e.phone })));
}

main().catch(console.error);
