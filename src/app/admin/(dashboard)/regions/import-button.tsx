"use client";

import { useImportRegions } from "./import-action";
import { ad } from "@/lib/admin-ui";

export function ImportRegionsButton() {
  const { importRegions } = useImportRegions();

  return (
    <button
      onClick={() => {
        if (confirm("هل أنت متأكد من رغبتك في استيراد المناطق من القاعدة القديمة؟ سيتم إضافة المناطق غير الموجودة فقط.")) {
          importRegions();
        }
      }}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      استيراد من الموقع القديم 📥
    </button>
  );
}
