const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function testDbAlerts() {
  try {
    console.log("=== Fetching scheduled alerts from Database (JS) ===");
    const records = await prisma.schemaPlaceholder.findMany({
      where: {
        note: {
          startsWith: "scheduled_alert:",
        },
      },
    });

    console.log(`Found ${records.length} records in Database.`);
    
    for (const rec of records) {
      console.log(`- Record ID: ${rec.id}, Created At: ${rec.createdAt}`);
      try {
        const jsonStr = rec.note.substring("scheduled_alert:".length);
        const data = JSON.parse(jsonStr);
        console.log("  Data:", JSON.stringify(data, null, 2));
      } catch (e) {
        console.log("  [Error parsing JSON]:", rec.note);
      }
    }
  } catch (error) {
    console.error("Error connecting to database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testDbAlerts();
