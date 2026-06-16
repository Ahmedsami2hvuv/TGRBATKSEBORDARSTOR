const fs = require("fs");
const path = require("path");

// قراءة ملف .env وتعيين متغيرات البيئة بفك الترميز الصحيح لـ URL
try {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        
        // فك ترميز الرابط ليكون صالحاً للمصادقة في node مباشرة
        if (key === "DATABASE_URL" || key === "DIRECT_URL") {
          value = decodeURIComponent(value);
        }
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.error("Error parsing .env file:", e);
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  try {
    const partner = await prisma.creditBookPartner.findFirst({
      where: { name: { contains: "رائد" } }
    });
    
    if (!partner) {
      console.log("Partner not found");
      return;
    }
    
    console.log("Partner ID:", partner.id);
    console.log("Partner Name:", partner.name);
    console.log("Partner Type:", partner.type);
    console.log("External ID:", partner.externalId);

    // 1. جلب حركات أموال الطلبات للمندوب
    const orderEvents = await prisma.orderCourierMoneyEvent.findMany({
      where: {
        courierId: partner.externalId,
        deletedAt: null,
        recordedByCompanyPreparerId: null
      }
    });
    console.log("Total order money events:", orderEvents.length);
    let orderGave = 0;
    let orderTook = 0;
    orderEvents.forEach(me => {
      const amt = Number(me.amountDinar || 0);
      if (me.kind === "delivery_in") orderGave += amt;
      else if (me.kind === "pickup_out") orderTook += amt;
    });
    console.log("Order money sums:", { orderGave, orderTook, net: orderGave - orderTook });

    // 2. جلب قيود المحفظة اليدوية للمندوب
    const miscEntries = await prisma.courierWalletMiscEntry.findMany({
      where: {
        courierId: partner.externalId,
        deletedAt: null
      }
    });
    console.log("Total misc entries:", miscEntries.length);
    let miscGave = 0;
    let miscTook = 0;
    miscEntries.forEach(me => {
      const amt = Number(me.amountDinar || 0);
      if (me.direction === "take") miscGave += amt;
      else miscTook += amt;
    });
    console.log("Misc entries sums:", { miscGave, miscTook, net: miscGave - miscTook });

    // 3. جلب التحويلات المقبولة للإدارة
    const transfers = await prisma.walletPeerTransfer.findMany({
      where: {
        fromCourierId: partner.externalId,
        toKind: "admin",
        status: "accepted"
      }
    });
    console.log("Total accepted transfers to Admin:", transfers.length);
    let transfersSum = 0;
    transfers.forEach(t => {
      transfersSum += Number(t.amountDinar || 0);
    });
    console.log("Transfers Sum:", transfersSum);

    // 4. أرباح التوصيل للمندوب
    const earnings = await prisma.order.findMany({
      where: {
        courierEarningForCourierId: partner.externalId,
        status: { in: ["delivered", "archived"] },
        courierEarningDinar: { gt: 0 }
      }
    });
    console.log("Total orders with earnings:", earnings.length);
    let earningsSum = 0;
    earnings.forEach(o => {
      earningsSum += Number(o.courierEarningDinar || 0);
    });
    console.log("Earnings Sum:", earningsSum);

  } catch (err) {
    console.error("Prisma error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
