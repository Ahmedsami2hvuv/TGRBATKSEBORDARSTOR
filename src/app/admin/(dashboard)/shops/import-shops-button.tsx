"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "confirming">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    setStatus("loading");
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
    try {
      // 1. سحب المحلات
      const res = await fetch("/api/admin/import/shops", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        alert(`تم سحب ${data.count} محل بنجاح! جاري سحب الزبائن الآن تلقائياً...`);

        // 2. سحب الزبائن فوراً
        const resCust = await fetch("/api/admin/import/customers", { method: "POST" });
        const dataCust = await resCust.json();

        alert(`اكتمل السحب الشامل: تم سحب ${dataCust.customers} زبون وربطهم بمحلاتهم.`);
        window.location.reload();
      } else {
        alert("فشل سحب المحلات: " + data.message);
      }
    } catch (err) {
      alert("حدث خطأ أثناء السحب الشامل");
    } finally {
      setStatus("idle");
    }
  }

  async function handleReset() {
    if (!confirm("⚠️ تحذير: سيتم مسح جميع المحلات والزبائن والطلبات الحالية! هل أنت متأكد؟")) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/import/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("تم تصفير النظام بنجاح. يمكنك السحب الآن على نظيف.");
        window.location.reload();
      } else {
        alert("فشل التصفير: " + data.message);
      }
    } catch (err) {
      alert("خطأ في الاتصال بالسيرفر");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex gap-3 items-center">
      <button
        onClick={handleReset}
        disabled={status === "loading"}
        className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-bold border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        🗑️ مسح الكل
      </button>

      {status === "confirming" ? (
        <div className="flex gap-2 items-center bg-green-50 p-1 rounded-lg border border-green-200 shadow-sm animate-in fade-in zoom-in duration-300">
          <span className="text-sm font-bold px-2 text-green-700">وجدنا {foundCount} محل. سحب شامل؟</span>
          <button onClick={handleImport} className="bg-green-600 text-white px-3 py-1 rounded-md font-bold hover:bg-green-700">نعم، ابدأ</button>
          <button onClick={() => setStatus("idle")} className="bg-gray-400 text-white px-3 py-1 rounded-md hover:bg-gray-500">إلغاء</button>
        </div>
      ) : (
        <button
          onClick={handleCheck}
          disabled={status === "loading"}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all disabled:bg-gray-400"
        >
          {status === "loading" ? "⏳ جاري العمل..." : "📥 سحب شامل (محلات + زبائن)"}
        </button>
      )}
    </div>
  );
}
