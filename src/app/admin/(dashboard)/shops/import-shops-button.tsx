"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "confirming">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [stats, setStats] = useState({ shops: 0, photos: 0, emps: 0 });
  const [totalShops, setTotalShops] = useState(0);

  async function handleCheck() {
    setStatus("loading");
    setCurrentStep("جاري الفحص الدقيق...");
    try {
      const res = await fetch("/api/admin/import/shops/check");
      const data = await res.json();
      if (data.success) {
        setTotalShops(data.totalInOld);
        setStatus("confirming");
      }
    } catch {
      alert("خطأ في الاتصال");
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("loading");
    setProgress(1);
    const newStats = { shops: 0, photos: 0, emps: 0 };

    try {
      // المرحلة 1: المحلات والصور (0% - 85%)
      let offset = 0;
      const limit = 10; // دفعات صغيرة لضمان رفع الصور بنجاح
      let isShopsDone = false;

      while (!isShopsDone) {
        setCurrentStep(`جاري سحب المحلات ورفع الصور لـ R2 (${offset} من ${totalShops})...`);
        const res = await fetch("/api/admin/import/shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        newStats.shops += data.count;
        newStats.photos += (data.photos || 0);
        offset += limit;
        isShopsDone = data.done || offset >= totalShops;

        setProgress(Math.min(Math.round((offset / totalShops) * 85), 85));
      }

      // المرحلة 2: العملاء (85% - 100%)
      setCurrentStep("جاري ربط العملاء بمحلاتهم...");
      let empOffset = 0;
      const empLimit = 50;
      let isEmpDone = false;

      while (!isEmpDone) {
        const res = await fetch("/api/admin/import/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset: empOffset, limit: empLimit })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        newStats.emps += data.count;
        empOffset += empLimit;
        isEmpDone = data.done;
        setProgress(prev => Math.min(prev + 5, 99));
      }

      setStats(newStats);
      setProgress(100);
      setCurrentStep("🎊 اكتمل السحب الشامل بنجاح!");

      alert(`✅ تم السحب بنجاح!\n\n- المحلات: ${newStats.shops}\n- الصور المرفوعة لـ R2: ${newStats.photos}\n- العملاء (أصحاب الروابط): ${newStats.emps}`);
      window.location.reload();

    } catch (err: any) {
      alert("⚠️ توقف السحب: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      <div className="flex gap-3 items-center justify-end">
        <button
          onClick={() => {
            if(confirm("تحذير: سيتم مسح كافة المحلات والعملاء للبدء من جديد. هل أنت متأكد؟")) {
              fetch("/api/admin/import/reset", { method: "POST" }).then(() => window.location.reload());
            }
          }}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold border border-red-200 hover:bg-red-100 transition-colors"
        >
          🗑️ مسح الكل
        </button>

        {status === "confirming" ? (
          <button onClick={handleImport} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg animate-pulse">
            ابدأ السحب الشامل (334 محل)
          </button>
        ) : (
          <button
            onClick={handleCheck}
            disabled={status === "loading"}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-indigo-700 disabled:bg-gray-400"
          >
            {status === "loading" ? "⏳ جاري العمل..." : "📥 سحب شامل (محلات + صور + عملاء)"}
          </button>
        )}
      </div>

      {status === "loading" && (
        <div className="w-full bg-white p-3 rounded-xl border-2 border-indigo-100 shadow-xl animate-in zoom-in duration-300">
          <div className="flex justify-between mb-2">
            <span className="text-[11px] font-black text-indigo-700">{currentStep}</span>
            <span className="text-[11px] font-black text-indigo-700">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200 p-0.5">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
