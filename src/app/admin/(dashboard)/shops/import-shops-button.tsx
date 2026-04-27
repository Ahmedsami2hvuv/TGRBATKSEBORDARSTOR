"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "confirming">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [totalShops, setTotalShops] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    setStatus("loading");
    setCurrentStep("جاري فحص البيانات...");
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

    try {
      // المرحلة الأولى: سحب المحلات (0% - 80%)
      let offset = 0;
      const limit = 20;
      let isShopsDone = false;

      while (!isShopsDone) {
        setCurrentStep(`جاري سحب المحلات (${offset} من ${totalShops})...`);
        const res = await fetch("/api/admin/import/shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        offset += limit;
        isShopsDone = data.done || offset >= totalShops;
        setProgress(Math.min(Math.round((offset / totalShops) * 80), 80));
      }

      // المرحلة الثانية: سحب العملاء (80% - 100%)
      setCurrentStep("جاري سحب العملاء (أصحاب الروابط) بنظام الدفعات...");
      let empOffset = 0;
      const empLimit = 50;
      let isEmpDone = false;
      let totalEmps = 0;

      while (!isEmpDone) {
        const res = await fetch("/api/admin/import/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset: empOffset, limit: empLimit })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        totalEmps += data.count;
        empOffset += empLimit;
        isEmpDone = data.done;

        // زيادة التقدم تدريجياً من 80% إلى 100%
        setProgress(prev => Math.min(prev + 5, 99));
      }

      setProgress(100);
      setCurrentStep("🎊 اكتمل السحب بنجاح!");
      alert(`اكتملت العملية بنجاح!\nتم سحب المحلات والعملاء وربطهم بنجاح.`);
      window.location.reload();

    } catch (err: any) {
      alert("⚠️ توقف السحب عند العملاء: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      <div className="flex gap-3 items-center justify-end">
        <button
          onClick={() => {
            if(confirm("سيتم تصفير كل شيء، هل أنت متأكد؟")) {
              fetch("/api/admin/import/reset", { method: "POST" }).then(() => window.location.reload());
            }
          }}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold border border-red-200"
        >
          🗑️ مسح الكل
        </button>

        {status === "confirming" ? (
          <button onClick={handleImport} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold animate-pulse">
            ابدأ السحب الآن
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

      {status === "loading" && (
        <div className="w-full bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
          <div className="flex justify-between mb-1">
            <span className="text-[10px] font-black text-indigo-600 uppercase">{currentStep}</span>
            <span className="text-[10px] font-black text-indigo-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
            <div
              className="bg-indigo-600 h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
