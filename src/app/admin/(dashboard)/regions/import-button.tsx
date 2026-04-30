"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function ImportRegionsButton({ icons }: { icons: GlobalIconsConfig | null }) {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    setStatus("checking");
    try {
      // إضافة timestamp لمنع الكاش (Cache)
      const res = await fetch(`/api/admin/import/regions/check?t=${Date.now()}`);
      const data = await res.json();

      if (data.success) {
        if (data.newCount === 0) {
          alert("كل المناطق موجودة بالفعل في نظامك الحالي.");
          setStatus("idle");
        } else {
          setFoundCount(data.newCount);
          setStatus("confirming");
        }
      } else {
        alert("تنبيه: " + (data.message || "لا يمكن الوصول للقاعدة القديمة حالياً."));
        setStatus("idle");
      }
    } catch (err) {
      alert("خطأ تقني: تأكد من أنك تفتح الموقع من الرابط الأساسي aboakbar.vercel.app");
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("importing");
    try {
      const res = await fetch("/api/admin/import/regions", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`تم استيراد ${data.count} منطقة بنجاح! سيتم تحديث الصفحة الآن.`);
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
        <div className="bg-yellow-50 border-2 border-yellow-400 p-2 rounded-lg flex items-center gap-2 shadow-md">
          <span className="text-sm font-bold text-yellow-800">وجدنا {foundCount} منطقة. هل نسحبهم؟</span>
          <button onClick={handleImport} className="bg-green-600 text-white px-3 py-1 rounded font-bold hover:bg-green-700">نعم</button>
          <button onClick={() => setStatus("idle")} className="bg-gray-500 text-white px-3 py-1 rounded">لا</button>
        </div>
      ) : (
        <button
          onClick={handleCheck}
          disabled={status !== "idle"}
          className={`px-5 py-2 rounded-md font-bold text-white shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
            status === "idle" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-gray-400"
          }`}
        >
          {status === "checking" ? <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-4 h-4" /> :
           status === "importing" ? <DynamicIcon iconKey="ui_download" config={icons} fallback="📥" className="w-4 h-4" /> :
           <DynamicIcon iconKey="ui_download" config={icons} fallback="📥" className="w-4 h-4" />}

          {status === "checking" ? "جاري الفحص..." :
           status === "importing" ? "جاري السحب..." :
           "استيراد المناطق (اضغط هنا)"}
        </button>
      )}
    </div>
  );
}
