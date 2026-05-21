"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function useImportShops() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

  async function importShops() {
    setIsPending(true);
    const promise = fetch(`/api${SECRET_ADMIN_PATH}/import/shops`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "فشل استيراد المحلات");
        }
        return res.json();
      })
      .finally(() => setIsPending(false));

    toast.promise(promise, {
      loading: "جاري استيراد المحلات وربطها بالمناطق...",
      success: (data) => {
        router.refresh();
        return `تم استيراد ${data.count} محل بنجاح! (تخطي ${data.skipped})`;
      },
      error: (err) => err.message,
    });
  }

  return { importShops, isPending };
}
