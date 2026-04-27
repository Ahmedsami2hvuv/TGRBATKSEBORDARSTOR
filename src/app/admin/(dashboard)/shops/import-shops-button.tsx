"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "confirming">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [totalInOld, setTotalInOld] = useState(0);

  async function handleCheck() {
    setStatus("loading");
    setCurrentStep("جاري فحص النواقص...");
    try {
      const res = await fetch("/api/admin/import/shops/check");
      const data = await res.json();
      if (data.success) {
        setTotalInOld(data.totalInOld);
        setStatus("confirming");
      }
    } catch {
      alert("خطأ في الاتصال");
      setStatus("idle");
    }
  }

  async function startDeepSync() {
    setStatus("loading");
    setProgress(1);

    try {
      // المرحلة الأولى: إكمال النقص في المحلات (0% - 30%)
      let offset = 0;
      const limit = 20;
      let isShopsDone = false;
      let newShopsCount = 0;

      while (!isShopsDone) {
        setCurrentStep(`المرحلة 1: جاري إكمال المحلات الناقصة (${offset}/${totalInOld})...`);
        const res = await fetch("/api/admin/import/shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit })
        });
        const data = await res.json();
        newShopsCount += data.count;
        offset += limit;
        isShopsDone = data.done || offset >= totalInOld;
        setProgress(Math.min(Math.round((offset / totalInOld) * 30), 30));
      }

      // المرحلة الثانية: سحب الصور الشامل (30% - 100%)
      setCurrentStep("المرحلة 2: جاري سحب الصور لجميع المحلات (334 محل)...");
      let photoOffset = 0;
      const photoLimit = 10; // دفعات صغيرة للصور
      let isPhotosDone = false;
      let totalPhotosSynced = 0;

      while (!isPhotosDone) {
        setCurrentStep(`جاري رفع الصور لـ R2 (${photoOffset}/${totalInOld})...`);
        const res = await fetch("/api/admin/import/shops/sync-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset: photoOffset, limit: photoLimit })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        totalPhotosSynced += data.updated;
        photoOffset += photoLimit;
        isPhotosDone = data.done || photoOffset >= totalInOld;

        const photoProgress = 30 + Math.min(Math.round((photoOffset / totalInOld) * 70), 70);
        setProgress(photoProgress);
      }

      setProgress(100);
      setCurrentStep("🎉 اكتملت المزامنة الشاملة بنجاح!");
      alert(`✅ تم إكمال المهمة بنجاح!\n\n- تم جلب ${newShopsCount} محل ناقص.\n- تم رفع وتأمين ${totalPhotosSynced} صورة على Cloudflare R2.`);
      window.location.reload();

    } catch (err: any) {
      alert("⚠️ حدث خطأ أثناء المزامنة: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      <div className="flex gap-3 items-center justify-end">
        <button
          onClick={() => {
            if(confirm("تحذير: هذا سيحذف كل المحلات والعملاء والطلبات. هل أنت متأكد؟")) {
              fetch("/api/admin/import/reset", { method: "POST" }).then(() => window.location.reload());
            }
          }}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold border border-red-200 text-xs"
        >
          🗑️ مسح الكل
        </button>

        {status === "confirming" ? (
          <button onClick={startDeepSync} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg animate-pulse">
            بدأ المزامنة الشاملة (محلات + صور)
          </button>
        ) : (
          <button
            onClick={handleCheck}
            disabled={status === "loading"}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:bg-gray-400"
          >
            {status === "loading" ? "⏳ جاري العمل..." : "🔄 مزامنة الصور والنواقص"}
          </button>
        )}
      </div>

      {status === "loading" && (
        <div className="w-full bg-white p-4 rounded-xl border-2 border-indigo-100 shadow-xl animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between mb-2">
            <span className="text-[10px] font-black text-indigo-700 tracking-tighter uppercase">{currentStep}</span>
            <span className="text-[10px] font-black text-indigo-700">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
            <div
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 h-full transition-all duration-700 ease-out shadow-[0_0_15px_rgba(79,70,229,0.4)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
