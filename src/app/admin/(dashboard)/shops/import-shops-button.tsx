"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [totalShops, setTotalShops] = useState(334); // القيمة التقريبية
  const router = useRouter();

  // 1. وظيفة إكمال المحلات الناقصة فقط
  async function importMissingShops() {
    setStatus("loading");
    setProgress(0);
    try {
      // فحص العدد الكلي أولاً
      const checkRes = await fetch("/api/admin/import/shops/check");
      const checkData = await checkRes.json();
      const total = checkData.totalInOld || 334;
      setTotalShops(total);

      let offset = 0;
      const limit = 20;
      let isDone = false;
      let newCount = 0;

      while (!isDone) {
        setCurrentStep(`جاري فحص وجلب المحلات الناقصة (${offset}/${total})...`);
        const res = await fetch("/api/admin/import/shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit })
        });
        const data = await res.json();
        newCount += data.count;
        offset += limit;
        isDone = data.done || offset >= total;
        setProgress(Math.round((offset / total) * 100));
      }

      alert(`✅ اكتمل جلب النواقص: تم إضافة ${newCount} محل جديد.`);
      window.location.reload();
    } catch (err: any) {
      alert("⚠️ خطأ في جلب النواقص: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  // 2. وظيفة سحب وتأمين الصور لـ R2 فقط
  async function syncPhotosToR2() {
    setStatus("loading");
    setProgress(0);
    try {
      const total = 334; // نفترض فحص الكل
      let offset = 0;
      const limit = 10;
      let isDone = false;
      let totalSynced = 0;

      while (!isDone) {
        setCurrentStep(`📸 جاري تأمين الصور على R2 (${offset}/${total})...`);
        const res = await fetch("/api/admin/import/shops/sync-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        totalSynced += data.updated;
        offset += limit;
        isDone = data.done || offset >= total;
        setProgress(Math.round((offset / total) * 100));
      }

      alert(`✅ اكتمل تأمين الصور: تم رفع وتحديث ${totalSynced} صورة على Cloudflare R2.`);
      window.location.reload();
    } catch (err: any) {
      alert("⚠️ خطأ في مزامنة الصور: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg">
      <div className="flex flex-wrap gap-3 items-center justify-end">
        {/* زر النواقص */}
        <button
          onClick={importMissingShops}
          disabled={status === "loading"}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 disabled:bg-gray-400 transition-all text-sm"
        >
          📥 جلب المحلات الناقصة
        </button>

        {/* زر الصور */}
        <button
          onClick={syncPhotosToR2}
          disabled={status === "loading"}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-purple-700 disabled:bg-gray-400 transition-all text-sm"
        >
          📸 سحب وتأمين الصور لـ R2
        </button>

        {/* زر المسح */}
        <button
          onClick={() => {
            if(confirm("سيتم مسح كافة المحلات والعملاء، هل أنت متأكد؟")) {
              fetch("/api/admin/import/reset", { method: "POST" }).then(() => window.location.reload());
            }
          }}
          className="bg-red-50 text-red-500 px-3 py-2 rounded-lg font-bold border border-red-100 hover:bg-red-100 text-xs"
        >
          🗑️ مسح الكل
        </button>
      </div>

      {status === "loading" && (
        <div className="w-full bg-white p-4 rounded-xl border-2 border-indigo-100 shadow-xl animate-in fade-in zoom-in">
          <div className="flex justify-between mb-2">
            <span className="text-xs font-black text-indigo-700 uppercase tracking-tight">{currentStep}</span>
            <span className="text-xs font-black text-indigo-700">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200 shadow-inner">
            <div
              className="bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
