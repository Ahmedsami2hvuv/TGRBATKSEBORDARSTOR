import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function main() {
  console.log("--- فحص الصور في كلاود فلير R2 ---");
  let continuationToken;
  let totalObjects = 0;
  let nonWebpImages = 0;
  let webpImages = 0;

  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      ContinuationToken: continuationToken,
    }));

    if (res.Contents) {
      totalObjects += res.Contents.length;
      for (const obj of res.Contents) {
        const key = obj.Key || "";
        if (/\.(jpg|jpeg|png)$/i.test(key)) {
          nonWebpImages++;
        } else if (/\.webp$/i.test(key)) {
          webpImages++;
        }
      }
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  console.log(`إجمالي الملفات في R2: ${totalObjects}`);
  console.log(`صور قديمة تحتاج تحويل (JPG/PNG): ${nonWebpImages}`);
  console.log(`صور بصيغة WebP بالفعل: ${webpImages}`);

  console.log("\n--- فحص الصور في قاعدة البيانات ---");
  const shopsCount = await prisma.shop.count({
    where: { photoUrl: { contains: ".jpg" } }
  });
  console.log(`محلات بروابط JPG: ${shopsCount}`);

  const ordersCount = await prisma.order.count({
    where: {
      OR: [
        { imageUrl: { contains: ".jpg" } },
        { shopDoorPhotoUrl: { contains: ".jpg" } },
        { customerDoorPhotoUrl: { contains: ".jpg" } },
      ]
    }
  });
  console.log(`طلبات بروابط JPG: ${ordersCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
