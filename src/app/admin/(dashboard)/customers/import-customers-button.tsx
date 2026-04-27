"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportCustomersButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    console.log("Checking customers...");
    setStatus("checking");
    try {
      const res = await fetch("/api/admin/import/customers/check");
      if (!res.ok) throw new Error("فشل الاتصال بسيرفر الفحص");

      const data = await res.json();
      if (data.success) {
        if (data.newCount === 0) {
          alert("لا يوجد زبائن جدد للسحب.");
          setStatus("idle");
        } else {
          setFoundCount(data.newCount);
          setStatus("confirming");
        }
      } else {
        alert("خطأ: " + data.message);
        setStatus("idle");
      }
    } catch (err: any) {
      alert("تعذر الاتصال بالقاعدة القديمة: " + err.message);
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("importing");
    try {
      const res = await fetch("/api/admin/import/customers", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`تم استيراد ${data.customers} زبون و ${data.profiles} ملف شخصي بنجاح!`);
        router.refresh();
      } else {
        alert("فشل في السحب: " + data.message);
      }
    } catch (err) {
      alert("حدث خطأ أثناء السحب.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {status === "confirming" ? (
        <div className="bg-blue-50 border border-blue-400 p-2 rounded flex items-center gap-2 shadow-sm">
          <span className="text-sm font-bold text-blue-800 italic">وجدنا {foundCount} سجل جديد. سحبهم؟</span>
          <button onClick={handleImport} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">نعم، سحب</button>
          <button onClick={() => setStatus("idle")} className="bg-gray-400 text-white px-3 py-1 rounded text-xs">إلغاء</button>
        </div>
      ) : (
        <button
          onClick={handleCheck}
          disabled={status !== "idle"}
          className={`px-5 py-2 rounded-full font-bold text-white shadow-xl transition-all active:scale-90 ${
            status === "idle" ? "bg-blue-600" : "bg-gray-400"
          }`}
        >
          {status === "checking" ? "🔍 جاري الفحص..." :
           status === "importing" ? "📥 جاري السحب..." :
           "استيراد الزبائن (ذكي) 📥"}
        </button>
      )}
    </div>
  );
}
