"use client";

import { useImportShops } from "./import-shops-action";
import { ad } from "@/lib/admin-ui";

export function ImportShopsButton() {
  const { importShops } = useImportShops();

  return (
    <button
      onClick={() => {
        if (confirm("هل أنت متأكد من رغبتك في استيراد المحلات؟ سيتم ربط كل محل بمنطقته تلقائياً.")) {
          importShops();
        }
      }}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
    >
      استيراد المحلات 📥
    </button>
  );
}
