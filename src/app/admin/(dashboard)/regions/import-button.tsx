"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ImportRegionsButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    console.log("Checking regions...");
    setStatus("checking");
    try {
      const res = await fetch("/api/admin/import/regions/check");
      if (!res.ok) throw new Error("فشل الاتصال بالخادم");

      const data = await res.json();
      if (data.success) {
        if (data.newCount === 0) {
          alert("لا توجد مناطق جديدة في القاعدة القديمة.");
          setStatus("idle");
        } else {
          setFoundCount(data.newCount);
          setStatus("confirming");
        }
      } else {
        throw new Error(data.message || "حدث خطأ غير معروف");
      }
    } catch (err: any) {
      alert("خطأ أثناء الفحص: " + err.message);
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("importing");
    try {
      const res = await fetch("/api/admin/import/regions", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`تم سحب ${data.count} منطقة بنجاح!`);
        router.refresh();
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      alert("فشل السحب: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {status === "confirming" ? (
        <div className="bg-yellow-50 border border-yellow-400 p-2 rounded flex items-center gap-2">
          <span className="text-sm font-bold text-yellow-800">وجدنا {foundCount} منطقة جديدة. اسحب؟</span>
          <button onClick={handleImport} className="bg-green-600 text-white px-2 py-1 rounded text-xs">نعم</button>
          <button onClick={() => setStatus("idle")} className="bg-gray-500 text-white px-2 py-1 rounded text-xs">إلغاء</button>
        </div>
      ) : (
        <button
          onClick={handleCheck}
          disabled={status !== "idle"}
          className={`px-4 py-2 rounded font-bold text-white shadow-lg transition-all ${
            status === "idle" ? "bg-indigo-600 hover:scale-105" : "bg-gray-400"
          }`}
        >
          {status === "checking" ? "🔍 جاري الفحص..." :
           status === "importing" ? "📥 جاري السحب..." :
           "استيراد المناطق (اضغط هنا)"}
        </button>
      )}
    </div>
  );
}
