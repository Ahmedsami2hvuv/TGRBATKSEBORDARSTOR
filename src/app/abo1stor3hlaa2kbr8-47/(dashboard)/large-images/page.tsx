import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { getS3Client, BUCKET_NAME } from "@/lib/upload-storage";
import Link from "next/link";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { LargeImagesManager } from "./large-images-manager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export default async function LargeImagesPage() {
  const icons = await getGlobalIcons();

  // 1. الاتصال بـ R2 وجلب قائمة الملفات
  let largeObjects: {
    key: string;
    sizeKb: number;
    sizeMb: string;
    size: number;
    lastModified?: Date;
    usages: string[];
    url: string;
  }[] = [];
  let allLargeObjects: {
    key: string;
    sizeKb: number;
    sizeMb: string;
    size: number;
    lastModified?: Date;
  }[] = [];
  let errorMsg = "";
  let totalBucketSize = 0;
  let totalLargeSize = 0;
  let orphanedCount = 0;

  try {
    const s3Client = await getS3Client();
    if (!s3Client || !BUCKET_NAME) {
      errorMsg = "إعدادات الاتصال بـ Cloudflare R2 غير متوفرة في البيئة (.env)";
    } else {
      const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      
      let isTruncated = true;
      let continuationToken: string | undefined = undefined;
      const contents: any[] = [];

      while (isTruncated) {
        const listCommand = new ListObjectsV2Command({
          Bucket: BUCKET_NAME,
          ContinuationToken: continuationToken,
        });
        const r2Objects = await s3Client.send(listCommand);
        if (r2Objects.Contents) {
          contents.push(...r2Objects.Contents);
        }
        isTruncated = !!r2Objects.IsTruncated;
        continuationToken = r2Objects.NextContinuationToken;
      }

      if (contents.length > 0) {
        // 1. تصفية وحساب المساحات وتجميع مفاتيح الصور الكبيرة أولاً
        contents.forEach(obj => {
          const size = obj.Size ?? 0;
          totalBucketSize += size;

          if (size > 500 * 1024) {
            totalLargeSize += size;
            const key = obj.Key ?? "";
            const sizeKb = Math.round(size / 1024);
            const sizeMb = (size / (1024 * 1024)).toFixed(2);

            allLargeObjects.push({
              key,
              sizeKb,
              sizeMb,
              size,
              lastModified: obj.LastModified,
            });
          }
        });

        // ترتيب تنازلي حسب الحجم لاختيار الأكبر أولاً
        allLargeObjects.sort((a, b) => b.size - a.size);

        // بناء قائمة الكائنات الكبيرة بدون استخدامات لتمريرها للكلاينت مباشرة (سيتم تحميل الاستخدامات تفاعلياً)
        allLargeObjects.forEach(obj => {
          largeObjects.push({
            key: obj.key,
            sizeKb: obj.sizeKb,
            sizeMb: obj.sizeMb,
            size: obj.size,
            lastModified: obj.lastModified,
            usages: [], // سيتم تحميلها في الخلفية بالكلاينت
            url: `/uploads/${obj.key}`,
          });
        });
      }
    }
  } catch (e: any) {
    console.error("R2 large images load failed:", e);
    errorMsg = `فشل الاتصال بـ Cloudflare R2: ${e.message || e}`;
  }

  const totalBucketSizeMb = (totalBucketSize / (1024 * 1024)).toFixed(1);
  const totalLargeSizeMb = (totalLargeSize / (1024 * 1024)).toFixed(1);
  const totalLargeCount = allLargeObjects.length;

  return (
    <div className="space-y-6 pb-20 text-right animate-in fade-in duration-300" dir="rtl">
      {/* الهيدر */}
      <div className="flex flex-col gap-1">
        <p className={ad.muted}>
          <Link href={`${SECRET_ADMIN_PATH}/customers`} className={ad.link}>
            <DynamicIcon iconKey="ui_arrow_right" config={icons} fallback="←" className="inline-block w-3 h-3 me-1" />
            العودة لصفحة الزبائن
          </Link>
        </p>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-800">مراقبة الصور الكبيرة في R2</h1>
            <p className="text-gray-500 text-sm mt-1">
              عرض وحذف الصور التي يتجاوز حجمها <span className="text-red-600 font-bold">500 كيلوبايت</span> لتحسين سرعة تحميل الموقع وتوفير التخزين.
            </p>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-3xl text-center">
          <p className="text-lg font-bold">⚠️ خطأ في الاتصال</p>
          <p className="text-sm mt-1">{errorMsg}</p>
        </div>
      ) : (
        <LargeImagesManager
          initialObjects={largeObjects}
          initialTotalBucketSizeMb={totalBucketSizeMb}
          initialTotalLargeSizeMb={totalLargeSizeMb}
          initialOrphanedCount={orphanedCount}
          initialTotalLargeCount={totalLargeCount}
          icons={icons}
        />
      )}
    </div>
  );
}
