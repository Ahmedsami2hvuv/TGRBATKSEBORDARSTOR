"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin-session";

export type ImportResult = {
  successCount: number;
  errorCount: number;
  errors: string[];
  batchId?: string;
  error?: string;
};

function extractGpsUrl(text: string): string {
  if (!text) return "";
  const match = text.match(/https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.app\.goo\.gl)\/[^\s'"]+/i);
  return match ? match[0] : "";
}

function cleanPhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("964") && !cleaned.startsWith("+")) return "+" + cleaned;
  return cleaned;
}

export async function importCustomersFromSql(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  if (!(await isAdminSession())) throw new Error("Unauthorized");

  const file = formData.get("sqlFile") as File;
  if (!file || file.size === 0) return { successCount: 0, errorCount: 0, errors: ["لم يتم اختيار ملف"], error: "الملف فارغ أو مفقود" };

  const batchId = `SQL_IMPORT_${new Date().getTime()}`;
  const text = await file.text();

  // تقسيم النص بناءً على جمل INSERT INTO
  const statements = text.split(/insert into/i);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });

  for (const statement of statements) {
    if (!statement.toLowerCase().includes("values")) continue;

    try {
      // استخراج كافة الكتل الموجودة بين الأقواس (لأنه قد يكون هناك Bulk Insert)
      const allValuesBlocks = statement.match(/\(([^)]+)\)/g);
      if (!allValuesBlocks) continue;

      for (const block of allValuesBlocks) {
        const rawValues = block
          .replace(/^\(|\)$/g, "") // إزالة الأقواس الخارجية
          .split(/,(?=(?:(?:[^']*'){2})*[^']*$)/) // تقسيم بالفاصلة مع تجاهل ما داخل النصوص
          .map(v => v.trim().replace(/^'|'$/g, ""));

        let phone = "";
        let locationUrl = "";
        let photoUrl = "";
        let foundRegionId = "";

        for (const val of rawValues) {
          const cleaned = val.trim();
          if (!cleaned || cleaned === "NULL") continue;

          if (!phone && (cleaned.startsWith("07") || cleaned.startsWith("+964") || (cleaned.length >= 10 && /^\d+$/.test(cleaned)))) {
            const p = cleanPhone(cleaned);
            if (p.length >= 10) phone = p;
          }
          if (!locationUrl && (cleaned.includes("google.com/maps") || cleaned.includes("maps.app.goo.gl"))) {
            locationUrl = extractGpsUrl(cleaned);
          }
          if (!photoUrl && (cleaned.includes("/uploads/") || cleaned.toLowerCase().endsWith(".jpg") || cleaned.toLowerCase().endsWith(".png") || cleaned.toLowerCase().endsWith(".webp"))) {
            photoUrl = cleaned;
          }
          if (!foundRegionId) {
            const region = allRegions.find(r => r.name === cleaned || cleaned.includes(r.name));
            if (region) foundRegionId = region.id;
          }
        }

        if (phone && foundRegionId) {
          await prisma.customerPhoneProfile.upsert({
            where: { phone_regionId: { phone, regionId: foundRegionId } },
            update: {
              locationUrl: locationUrl || undefined,
              photoUrl: photoUrl || undefined,
              notes: batchId
            },
            create: {
              phone,
              regionId: foundRegionId,
              locationUrl,
              photoUrl,
              notes: batchId
            }
          });
          successCount++;
        }
      }
    } catch (e) {
      errorCount++;
    }
  }

  revalidatePath("/admin/customers/profiles");
  return { successCount, errorCount, errors, batchId };
}

export async function undoImportBatch(batchId: string) {
  if (!(await isAdminSession())) throw new Error("Unauthorized");
  await prisma.customerPhoneProfile.deleteMany({ where: { notes: batchId } });
  revalidatePath("/admin/customers/profiles");
}
