"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    setStatus("checking");
    try {
      const res = await fetch("/api/admin/import/shops/check");
      const data = await res.json();
      if (data.success) {
        if (data.newCount === 0) {
          alert("لا توجد محلات جديدة للاستيراد.");
          setStatus("idle");
        } else {
          setFoundCount(data.newCount);
          setStatus("confirming");
        }
      } else {
        alert("خطأ: " + data.message);
        setStatus("idle");
      }
    } catch (err) {
      alert("فشل الاتصال بالقاعدة القديمة.");
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("importing");
    try {
      const res = await fetch("/api/admin/import/shops", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`تم سحب ${data.count} محل بنجاح!`);
        router.refresh();
      } else {
        alert("خطأ أثناء السحب: " + data.message);
      }
    } catch (err) {
      alert("حدث خطأ غير متوقع.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {status === "confirming" ? (
        <div className="bg-green-50 border border-green-500 p-2 rounded flex items-center gap-2">
          <span className="text-sm font-bold">وجدنا {foundCount} محل. سحبهم؟</span>
          <button onClick={handleImport} className="bg-green-600 text-white px-2 py-1 rounded text-xs">نعم</button>
          <button onClick={() => setStatus("idle")} className="bg-gray-500 text-white px-2 py-1 rounded text-xs">إلغاء</button>
        </div>
      ) : (
        <button
          onClick={handleCheck}
          disabled={status !== "idle"}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold shadow-md transition-all active:scale-95"
        >
          {status === "checking" ? "🔍 فحص..." : status === "importing" ? "📥 سحب..." : "استيراد المحلات (ذكي)"}
        </button>
      )}
    </div>
  );
}
