"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ملاحظة: سنستخدم الـ Server Action داخل ملف منفصل لأن Prisma لا تعمل مباشرة في Client Components
// ولكن بما أننا سنستخدم 'pg' فسنحتاج لعمل Route Handler أو Server Action حقيقي.

export function useImportRegions() {
  const router = useRouter();

  async function importRegions() {
    const promise = fetch("/api/admin/import/regions", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "فشل الاستيراد");
        }
        return res.json();
      });

    toast.promise(promise, {
      loading: "جاري استيراد المناطق من القاعدة القديمة...",
      success: (data) => {
        router.refresh();
        return `تم استيراد ${data.count} منطقة بنجاح!`;
      },
      error: (err) => err.message,
    });
  }

  return { importRegions };
}
