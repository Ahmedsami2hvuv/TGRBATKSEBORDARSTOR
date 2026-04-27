"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ImportRegionsButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    setStatus("checking");
    try {
      const res = await fetch("/api/admin/import/regions/check");
      const data = await res.json();
      if (data.success) {
        if (data.newCount === 0) {
          toast.info("لا توجد مناطق جديدة لاستيرادها.");
          setStatus("idle");
        } else {
          setFoundCount(data.newCount);
          setStatus("confirming");
        }
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast.error("خطأ في الاتصال: " + err.message);
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("importing");
    try {
      const res = await fetch("/api/admin/import/regions", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`تم سحب ${data.count} منطقة بنجاح من أصل ${foundCount}!`);
        router.refresh();
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast.error("فشل الاستيراد: " + err.message);
    } finally {
      setStatus("idle");
      setProgress(0);
    }
  }

  if (status === "confirming") {
    return (
      <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-200">
        <span className="text-sm text-indigo-700 font-bold">تم العثور على {foundCount} منطقة جديدة. سحبهم؟</span>
        <button onClick={handleImport} className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700">نعم، اسحب الآن</button>
        <button onClick={() => setStatus("idle")} className="bg-gray-400 text-white px-3 py-1 rounded text-xs">إلغاء</button>
      </div>
    );
  }

  return (
    <button
      onClick={handleCheck}
      disabled={status !== "idle"}
      className={`inline-flex items-center px-4 py-2 rounded-md shadow-sm text-white text-sm font-medium ${
        status === "idle" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-400 cursor-not-allowed"
      }`}
    >
      {status === "checking" && "جاري الفحص... 🔍"}
      {status === "importing" && "جاري السحب... 📥"}
      {status === "idle" && "استيراد المناطق (ذكي) 📥"}
    </button>
  );
}
