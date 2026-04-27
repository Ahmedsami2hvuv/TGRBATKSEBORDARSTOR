"use client";

import { useState } from "react";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing">("idle");
  const [foundCount, setFoundCount] = useState(0);

  async function handleCheck() {
    setStatus("checking");
    try {
      const res = await fetch(`/api/admin/import/shops/check?t=${Date.now()}`);
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
      alert("فشل في فحص المحلات. تأكد من فتح الموقع من الرابط الصحيح.");
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("importing");
    try {
      const res = await fetch("/api/admin/import/shops", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`تم سحب ${data.count} محل بنجاح! سيتم تحديث الصفحة.`);
        window.location.reload();
      } else {
        alert("فشل السحب: " + data.message);
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
        <div className="bg-green-100 border-2 border-green-500 p-2 rounded flex items-center gap-2">
          <span className="text-sm font-bold">وجدنا {foundCount} محل. سحبهم؟</span>
          <button onClick={handleImport} className="bg-green-600 text-white px-3 py-1 rounded">نعم</button>
          <button onClick={() => setStatus("idle")} className="bg-gray-500 text-white px-3 py-1 rounded">إلغاء</button>
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
