"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function useImportCustomers() {
  const router = useRouter();

  async function importCustomers() {
    const promise = fetch("/api/admin/import/customers", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "فشل استيراد الزبائن");
        }
        return res.json();
      });

    toast.promise(promise, {
      loading: "جاري استيراد الزبائن وربطهم بالمحلات والمناطق...",
      success: (data) => {
        router.refresh();
        return `تم استيراد ${data.count} زبون بنجاح! (تخطي ${data.skipped})`;
      },
      error: (err) => err.message,
    });
  }

  return { importCustomers };
}
