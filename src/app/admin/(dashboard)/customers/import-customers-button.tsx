"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportCustomersButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing" | "syncing_photos" | "resetting">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  async function handleReset() {
    if (!confirm("هل أنت متأكد من مسح جميع الزبائن؟ لا يمكن التراجع!")) return;
    setStatus("resetting");
    try {
      const res = await fetch("/api/admin/import/customers/reset", { method: "POST" });
      const data = await res.json();
      alert(data.message);
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
        alert("لا يوجد زبائن جدد");
        setStatus("idle");
      }
    } catch (e) { setStatus("idle"); }
  }

  async function handleImport() {
    setStatus("importing");
    try {
      const res = await fetch("/api/admin/import/customers", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("تم السحب بنجاح");
        router.refresh();
      }
    } catch (e) { alert("خطأ في السحب"); }
    setStatus("idle");
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
        setProgress(Math.min(99, progress + 10));
      }
      alert("اكتمل سحب صور الزبائن لـ R2");
    } catch (e) { alert("خطأ في سحب الصور"); }
    setStatus("idle");
    setProgress(0);
  }

  return (
    <div className="flex flex-col gap-3 items-end">
      <div className="flex gap-2">
        <button onClick={handleReset} className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow hover:bg-red-600">🗑️ مسح الكل</button>
        <button onClick={handleSyncPhotos} disabled={status !== "idle"} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow hover:bg-indigo-700">📸 سحب الصور لـ R2</button>
        <button onClick={handleCheck} disabled={status !== "idle"} className="bg-blue-600 text-white px-5 py-2 rounded-full font-bold shadow-xl hover:bg-blue-700">
          {status === "checking" ? "🔍 جاري الفحص..." : "استيراد الزبائن 📥"}
        </button>
      </div>

      {status === "confirming" && (
        <div className="bg-yellow-50 border border-yellow-400 p-3 rounded-lg flex items-center gap-3">
          <span className="text-sm font-bold">وجدنا {foundCount} زبون جديد. سحبهم؟</span>
          <button onClick={handleImport} className="bg-green-600 text-white px-3 py-1 rounded text-xs">نعم</button>
          <button onClick={() => setStatus("idle")} className="bg-gray-400 text-white px-3 py-1 rounded text-xs">إلغاء</button>
        </div>
      )}

      {status === "syncing_photos" && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
          <div className="bg-indigo-600 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
}
