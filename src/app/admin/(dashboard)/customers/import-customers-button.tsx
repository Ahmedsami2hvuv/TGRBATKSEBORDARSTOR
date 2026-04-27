"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ImportCustomersButton() {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const router = useRouter();

  async function handleCheck() {
    setStatus("checking");
    try {
      const res = await fetch("/api/admin/import/customers/check");
      const data = await res.json();
      if (data.success) {
        if (data.newCount === 0) {
          toast.info("لا يوجد زبائن جدد للاستيراد.");
          setStatus("idle");
        } else {
          setFoundCount(data.newCount);
          setStatus("confirming");
        }
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast.error("خطأ في فحص الزبائن: " + err.message);
      setStatus("idle");
    }
  }

  async function handleImport() {
    setStatus("importing");
    try {
      const res = await fetch("/api/admin/import/customers", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`تم سحب ${data.customers} زبون و ${data.profiles} بروفايل بنجاح!`);
        router.refresh();
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast.error("فشل استيراد الزبائن: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  if (status === "confirming") {
    return (
      <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg border border-blue-200">
        <span className="text-sm text-blue-700 font-bold">وجدنا حوالي {foundCount} سجل زبائن جديد. سحبهم؟</span>
        <button onClick={handleImport} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">نعم، استورد</button>
        <button onClick={() => setStatus("idle")} className="bg-gray-400 text-white px-3 py-1 rounded text-xs">إلغاء</button>
      </div>
    );
  }

  return (
    <button
      onClick={handleCheck}
      disabled={status !== "idle"}
      className={`inline-flex items-center px-4 py-2 rounded-md shadow-sm text-white text-sm font-medium ${
        status === "idle" ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-400 cursor-not-allowed"
      }`}
    >
      {status === "checking" && "جاري فحص قاعدة الزبائن... 🔍"}
      {status === "importing" && "جاري سحب الزبائن... 📥"}
      {status === "idle" && "استيراد الزبائن (ذكي) 📥"}
    </button>
  );
}
