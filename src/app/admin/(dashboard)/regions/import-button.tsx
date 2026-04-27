"use client";

import { useImportRegions } from "./import-regions-action";

export function ImportRegionsButton() {
  const { importRegions, isPending } = useImportRegions();

  return (
    <button
      onClick={() => {
        if (confirm("هل أنت متأكد من رغبتك في استيراد المناطق من القاعدة القديمة؟ سيتم إضافة المناطق غير الموجودة فقط.")) {
          importRegions();
        }
      }}
      disabled={isPending}
      className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
        isPending ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
    >
      {isPending ? (
        <>
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          جاري الاستيراد...
        </>
      ) : (
        "استيراد من الموقع القديم 📥"
      )}
    </button>
  );
}
