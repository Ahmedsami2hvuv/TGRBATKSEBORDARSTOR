"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useImportRegions() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function importRegions() {
    setIsPending(true);
    const promise = fetch("/api/admin/import/regions", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "فشل الاستيراد");
        }
        return res.json();
      })
      .finally(() => setIsPending(false));

    toast.promise(promise, {
      loading: "جاري استيراد المناطق من القاعدة القديمة...",
      success: (data) => {
        router.refresh();
        return `تم استيراد ${data.count} منطقة بنجاح!`;
      },
      error: (err) => err.message,
    });
  }

  return { importRegions, isPending };
}
