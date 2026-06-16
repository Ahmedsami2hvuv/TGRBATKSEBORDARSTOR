const { PrismaClient } = require('@prisma/client');

async function enableRealtime() {
  const prisma = new PrismaClient();

  try {
    console.log("Connected to DB via Prisma. Enabling realtime for 'Order' table...");
    
    // Attempt to add table to publication. It will throw if it's already there or if publication doesn't exist.
    // If it throws because publication doesn't exist, we create it.
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          CREATE PUBLICATION supabase_realtime;
        END IF;
      END
      $$;
    `);

    try {
      await prisma.$executeRawUnsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE "Order";`);
      console.log("Successfully enabled realtime for 'Order' table!");
    } catch (err) {
      if (err.message.includes('already in publication')) {
        console.log("'Order' table is already enabled for realtime.");
      } else {
        throw err;
      }
    }

  } catch (error) {
    console.error("Error enabling realtime:", error);
  } finally {
    await prisma.$disconnect();
  }
}

enableRealtime();
