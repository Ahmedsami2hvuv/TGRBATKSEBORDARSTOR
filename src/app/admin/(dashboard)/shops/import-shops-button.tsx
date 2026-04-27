"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "confirming">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [totalFound, setTotalFound] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    setStatus("loading");
    setCurrentStep("جاري فحص البيانات...");
    try {
      const res = await fetch("/api/admin/import/shops/check");
      const data = await res.json();
      if (data.success) {
        setTotalFound(data.totalInOld);
        setStatus("confirming");
      }
    } catch {
      alert("خطأ في الاتصال");
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("loading");
    setProgress(0);

    try {
      let offset = 0;
      const limit = 20;
      let isDone = false;
      let totalImported = 0;

      // 1. سحب المحلات على دفعات
      while (!isDone) {
        setCurrentStep(`جاري سحب المحلات (${offset} من ${totalFound})...`);
        const res = await fetch("/api/admin/import/shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        totalImported += data.count;
        offset += limit;
        isDone = data.done || offset >= totalFound;

        // تحديث شريط التقدم (نصل إلى 80% للمحلات)
        const calcProgress = Math.min(Math.round((offset / totalFound) * 80), 80);
        setProgress(calcProgress);
      }

      // 2. سحب العملاء
      setCurrentStep("جاري سحب العملاء (أصحاب الروابط)...");
      const resEmp = await fetch("/api/admin/import/employees", { method: "POST" });
      const dataEmp = await resEmp.json();

      setProgress(100);
      setCurrentStep("🎊 اكتمل السحب بنجاح!");

      alert(`اكتملت العملية:\n- سحب ${totalImported} محل.\n- سحب ${dataEmp.count || 0} عميل.`);
      window.location.reload();

    } catch (err: any) {
      alert("⚠️ توقف السحب: " + err.message);
    } finally {
      setStatus("idle");
      setProgress(0);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      <div className="flex gap-3 items-center justify-end">
        <button
          onClick={() => {
            if(confirm("سيتم تصفير المحلات والعملاء، هل أنت متأكد؟")) {
              fetch("/api/admin/import/reset", { method: "POST" }).then(() => window.location.reload());
            }
          }}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold border border-red-200"
        >
          🗑️ مسح الكل
        </button>

        {status === "confirming" ? (
          <button onClick={handleImport} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold animate-pulse">
            ابدأ سحب {totalFound} محل الآن
          </button>
        ) : (
          <button
            onClick={handleCheck}
            disabled={status === "loading"}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg disabled:bg-gray-400"
          >
            {status === "loading" ? "⏳ جاري العمل..." : "📥 سحب (محلات + عملاء)"}
          </button>
        )}
      </div>

      {status === "loading" && progress >= 0 && (
        <div className="w-full bg-white p-3 rounded-xl border border-indigo-100 shadow-sm transition-all">
          <div className="flex justify-between mb-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{currentStep}</span>
            <span className="text-[10px] font-bold text-indigo-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-700 ease-in-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
