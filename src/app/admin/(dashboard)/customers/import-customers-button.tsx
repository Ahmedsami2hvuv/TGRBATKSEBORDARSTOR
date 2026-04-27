"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportCustomersButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing" | "syncing_photos" | "resetting">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [importedNow, setImportedNow] = useState(0);
  const router = useRouter();

  async function handleReset() {
    if (!confirm("هل أنت متأكد من مسح جميع الزبائن؟")) return;
    setStatus("resetting");
    try {
      await fetch("/api/admin/import/customers/reset", { method: "POST" });
      router.refresh();
    } catch (e) { alert("خطأ في المسح"); }
    setStatus("idle");
  }

  async function handleCheck() {
    setStatus("checking");
    try {
      const res = await fetch("/api/admin/import/customers/check");
      const data = await res.json();
      if (data.success && data.newCount > 0) {
        setFoundCount(data.newCount);
        setStatus("confirming");
      } else {
        alert("لا يوجد زبائن جدد غير المسجلين حالياً");
        setStatus("idle");
      }
    } catch (e) { setStatus("idle"); }
  }

  async function handleImport() {
    setStatus("importing");
    setProgress(0);
    setImportedNow(0);

    // سحب الزبائن على دفعات لضمان عدم توقف السيرفر
    let totalNeeded = foundCount;
    let currentImported = 0;

    try {
      while (currentImported < totalNeeded) {
        const res = await fetch("/api/admin/import/customers", { method: "POST" });
        const data = await res.json();

        if (!data.success || data.customers === 0) break;

        currentImported += data.customers;
        setImportedNow(currentImported);
        setProgress(Math.round((currentImported / totalNeeded) * 100));

        // تحديث الواجهة خلف الكواليس لرؤية الزبائن الجدد
        router.refresh();

        if (data.customers < 5) break; // توقف إذا لم يتبق شيء ذو قيمة
      }
      alert(`اكتمل السحب! تم إضافة ${currentImported} زبون جديد.`);
    } catch (e) { alert("حدث توقف مؤقت، يمكنك الضغط على سحب مرة أخرى للإكمال."); }

    setStatus("idle");
    router.refresh();
  }

  async function handleSyncPhotos() {
    setStatus("syncing_photos");
    setProgress(0);
    let offset = 0;
    const limit = 20;

    try {
      while (true) {
        const res = await fetch("/api/admin/import/customers/sync-photos", {
          method: "POST",
          body: JSON.stringify({ offset, limit })
        });
        const data = await res.json();
        if (!data.success || data.done) break;
        offset += limit;
        setProgress(Math.min(100, (offset / foundCount) * 100));
      }
      alert("اكتمل سحب الصور.");
    } catch (e) { alert("خطأ في الصور"); }
    setStatus("idle");
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex gap-2">
        <button onClick={handleReset} className="bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-200 transition-colors">🗑️ مسح</button>
        <button onClick={handleSyncPhotos} disabled={status !== "idle"} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-700">📸 سحب الصور</button>
        <button onClick={handleCheck} disabled={status !== "idle"} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold shadow-xl hover:bg-blue-700 transition-all active:scale-95">
          {status === "checking" ? "🔍 فحص..." : status === "importing" ? "📥 جاري السحب..." : "استيراد الزبائن 📥"}
        </button>
      </div>

      {(status === "importing" || status === "syncing_photos") && (
        <div className="w-64 bg-white border p-2 rounded-lg shadow-sm">
           <div className="flex justify-between text-[10px] font-bold mb-1">
              <span>{status === "importing" ? "سحب البيانات" : "سحب الصور"}</span>
              <span>{progress}%</span>
           </div>
           <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
           </div>
           <p className="text-[9px] text-gray-500 mt-1">تم معالجة {importedNow} سجل...</p>
        </div>
      )}

      {status === "confirming" && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center gap-4 animate-in fade-in zoom-in duration-300">
          <span className="text-xs font-bold text-blue-800">وجدنا {foundCount} زبون جديد غير مسجلين. سحبهم؟</span>
          <div className="flex gap-2">
            <button onClick={handleImport} className="bg-blue-600 text-white px-4 py-1 rounded-lg text-xs font-bold">ابدأ السحب الآن</button>
            <button onClick={() => setStatus("idle")} className="text-gray-500 text-xs">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
