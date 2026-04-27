"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "confirming">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [foundCount, setFoundCount] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    setStatus("loading");
    setCurrentStep("جاري فحص البيانات المتاحة...");
    try {
      const res = await fetch("/api/admin/import/shops/check");
      const data = await res.json();
      if (data.success) {
        setFoundCount(data.totalInOld);
        setStatus("confirming");
      }
    } catch (err) {
      alert("خطأ في الفحص");
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("loading");
    setProgress(10);
    setCurrentStep("بدء عملية السحب الشامل...");

    try {
      // 1. سحب المحلات
      setCurrentStep("جاري سحب المحلات (334 محل)...");
      const resShops = await fetch("/api/admin/import/shops", { method: "POST" });
      const dataShops = await resShops.json();

      if (!dataShops.success) throw new Error(dataShops.message);

      setProgress(50);
      setCurrentStep(`✅ تم سحب ${dataShops.count} محل. جاري سحب العملاء (أصحاب الروابط)...`);

      // 2. سحب العملاء (الموظفين في الكود)
      const resEmp = await fetch("/api/admin/import/employees", { method: "POST" });
      const dataEmp = await resEmp.json();

      if (!dataEmp.success) throw new Error(dataEmp.message);

      setProgress(100);
      setCurrentStep("🎊 اكتمل السحب بنجاح!");

      alert(`اكتملت العملية بنجاح:\n- تم سحب ${dataShops.count} محل.\n- تم سحب ${dataEmp.count} عميل (صاحب رابط).`);
      window.location.reload();

    } catch (err: any) {
      alert("⚠️ فشل السحب: " + err.message);
    } finally {
      setStatus("idle");
      setProgress(0);
      setCurrentStep("");
    }
  }

  async function handleReset() {
    if (!confirm("⚠️ تحذير: سيتم مسح جميع المحلات والعملاء والطلبات! هل أنت متأكد؟")) return;
    setStatus("loading");
    setCurrentStep("جاري تصفير النظام...");
    try {
      const res = await fetch("/api/admin/import/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("تم تصفير النظام بنجاح.");
        window.location.reload();
      }
    } catch (err) {
      alert("خطأ في التصفير");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-md">
      <div className="flex gap-3 items-center justify-end">
        <button
          onClick={handleReset}
          disabled={status === "loading"}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold border border-red-200 hover:bg-red-100 disabled:opacity-50"
        >
          🗑️ مسح الكل
        </button>

        {status === "confirming" ? (
          <div className="flex gap-2 items-center bg-green-50 p-1 rounded-lg border border-green-200 shadow-md">
            <span className="text-xs font-bold px-2 text-green-700">سحب {foundCount} محل + عملائهم؟</span>
            <button onClick={handleImport} className="bg-green-600 text-white px-3 py-1 rounded-md font-bold">ابدأ</button>
            <button onClick={() => setStatus("idle")} className="bg-gray-400 text-white px-3 py-1 rounded-md">إلغاء</button>
          </div>
        ) : (
          <button
            onClick={handleCheck}
            disabled={status === "loading"}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-all"
          >
            📥 سحب (محلات + عملاء)
          </button>
        )}
      </div>

      {status === "loading" && (
        <div className="w-full bg-white p-3 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between mb-1">
            <span className="text-xs font-bold text-indigo-600">{currentStep}</span>
            <span className="text-xs font-bold text-indigo-600">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
