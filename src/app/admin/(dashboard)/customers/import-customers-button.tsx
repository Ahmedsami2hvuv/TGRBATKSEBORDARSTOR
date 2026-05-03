"use client";

import { useState } from "react";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function ImportCustomersButton({ icons }: { icons: GlobalIconsConfig | null }) {
  const [status, setStatus] = useState<"idle" | "checking" | "confirming" | "importing" | "syncing_photos" | "resetting">("idle");
  const [foundCount, setFoundCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [importedNow, setImportedNow] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const router = useRouter();

  function startCancelableTask() {
    cancelRequestedRef.current = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }

  function finishCancelableTask() {
    abortControllerRef.current = null;
    cancelRequestedRef.current = false;
  }

  function handleCancelImport() {
    cancelRequestedRef.current = true;
    abortControllerRef.current?.abort();
    setStatus("idle");
  }

  async function handleReset() {
    if (!confirm("هل أنت متأكد من مسح جميع الزبائن؟")) return;
    setStatus("resetting");
    try {
      await fetch("/api/admin/import/customers/reset", { method: "POST" });
      router.refresh();
      alert("تم المسح بنجاح");
    } catch (e) { alert("خطأ في المسح"); }
    setStatus("idle");
  }

  async function handleCheck() {
    setStatus("checking");
    try {
      const signal = startCancelableTask();
      const res = await fetch("/api/admin/import/customers/check", { signal });
      const data = await res.json();
      if (data.success) {
        const missingCount = Number(data.newCount || 0);
        if (missingCount <= 0) {
          alert("كل الزبائن مسحوبين بالفعل، ماكو نواقص.");
          setStatus("idle");
        } else {
          setFoundCount(missingCount);
          setStatus("confirming");
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setStatus("idle");
    } finally {
      finishCancelableTask();
    }
  }

  async function handleImport() {
    setStatus("importing");
    setProgress(0);
    setImportedNow(0);

    try {
      const signal = startCancelableTask();
      let currentOffset = 0;
      const batchSize = 120;
      let totalImported = 0;
      let totalSkipped = 0;
      const expected = foundCount > 0 ? foundCount : 5000;

      while (true) {
        if (cancelRequestedRef.current) break;
        const res = await fetch("/api/admin/import/customers/import-missing", {
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset: currentOffset, limit: batchSize }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || "فشل الاستيراد");

        const rowsFetched = Number(data.rowsFetched || 0);
        totalImported += Number(data.imported || 0);
        totalSkipped += Number(data.skippedExisting || 0);
        currentOffset += rowsFetched;
        setImportedNow(totalImported);
        setProgress(Math.min(100, Math.round((currentOffset / expected) * 100)));

        if (rowsFetched === 0 || data.done) break;
      }

      if (cancelRequestedRef.current) return;

      setProgress(100);
      router.refresh();
      alert(
        `اكتمل سحب النواقص فقط.\n` +
        `المستورَد الجديد: ${totalImported}\n` +
        `المتخطي (موجود مسبقاً): ${totalSkipped}`
      );
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        alert("حدث توقف: " + (e?.message || "يرجى المحاولة مرة أخرى."));
      }
    } finally {
      finishCancelableTask();
    }
    setStatus("idle");
  }

  async function handleSyncPhotos() {
    setStatus("syncing_photos");
    setProgress(0);
    setImportedNow(0);
    const total = foundCount > 0 ? foundCount : 5000;
    let currentOffset = 0;
    let totalSynced = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let totalNotFoundLocal = 0;

    try {
      const signal = startCancelableTask();
      while (currentOffset < total) {
        if (cancelRequestedRef.current) break;
        const res = await fetch("/api/admin/import/customers/sync-photos", { 
          method: "POST",
          signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset: currentOffset, limit: 15 })
        });
        const data = await res.json();

        if (!data.success || data.rowsFetched === 0) break;

        totalSynced += Number(data.synced || 0);
        totalSkipped += Number(data.skipped || 0);
        totalErrors += Number(data.errors || 0);
        totalNotFoundLocal += Number(data.notFoundLocal || 0);
        currentOffset += data.rowsFetched;
        setImportedNow(currentOffset);
        setProgress(Math.min(100, Math.round((currentOffset / total) * 100)));
      }
      if (!cancelRequestedRef.current) {
        router.refresh();
        alert(
          `اكتمل سحب الصور.\n` +
          `المرفوع إلى R2: ${totalSynced}\n` +
          `تم تخطيه: ${totalSkipped}\n` +
          `فشل: ${totalErrors}\n` +
          `غير موجود محلياً: ${totalNotFoundLocal}`
        );
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") alert("خطأ في سحب الصور: " + e.message);
    } finally {
      finishCancelableTask();
    }
    setStatus("idle");
  }

  async function handleCleanUrls() {
    setStatus("checking");
    try {
      const res = await fetch("/api/admin/import/customers/clean-urls", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`تم التنظيف بنجاح!\nصور أساسية رُفعت: ${data.profileUpdates}\nالزبائن المعدلين: ${data.customerUpdates}\nالطلبيات المعدلة: ${data.orderUpdates}`);
        router.refresh();
      } else {
        alert("حدث خطأ: " + data.message);
      }
    } catch (e) {
      alert("خطأ في الاتصال");
    }
    setStatus("idle");
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex gap-2">
        <button onClick={handleReset} className="bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-200 transition-colors flex items-center gap-1">
          <DynamicIcon iconKey="ui_delete" config={icons} fallback="🗑️" className="w-3.5 h-3.5" /> مسح
        </button>
        <button onClick={handleCleanUrls} disabled={status !== "idle"} className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-emerald-700 flex items-center gap-1">
          <DynamicIcon iconKey="ui_settings" config={icons} fallback="🧹" className="w-3.5 h-3.5" /> تنظيف الروابط
        </button>
        <button onClick={handleSyncPhotos} disabled={status !== "idle"} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-indigo-700 flex items-center gap-1">
          <DynamicIcon iconKey="ui_camera" config={icons} fallback="📸" className="w-3.5 h-3.5" /> سحب الصور
        </button>
        <button onClick={handleCheck} disabled={status !== "idle"} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2">
          {status === "checking" ? <DynamicIcon iconKey="ui_search" config={icons} fallback="🔍" className="w-4 h-4" /> :
           status === "importing" ? <DynamicIcon iconKey="ui_download" config={icons} fallback="📥" className="w-4 h-4" /> :
           <DynamicIcon iconKey="ui_download" config={icons} fallback="📥" className="w-4 h-4" />}

          {status === "checking" ? "فحص..." : status === "importing" ? "جاري السحب..." : "استيراد الزبائن"}
        </button>
      </div>

      {(status === "checking" || status === "importing" || status === "syncing_photos") && (
        <button
          onClick={handleCancelImport}
          className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-700"
        >
          إلغاء الاستيراد
        </button>
      )}

      {(status === "importing" || status === "syncing_photos") && (
        <div className="w-64 bg-white border p-2 rounded-lg shadow-sm">
           <div className="flex justify-between text-[10px] font-bold mb-1">
              <span>{status === "importing" ? "سحب البيانات" : "مزامنة الصور"}</span>
              <span>{progress}%</span>
           </div>
           <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
           </div>
           <p className="text-[9px] text-gray-500 mt-1">تمت معالجة {importedNow} سجل...</p>
        </div>
      )}

      {status === "confirming" && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center gap-4 animate-in fade-in zoom-in duration-300">
          <span className="text-xs font-bold text-blue-800">لكينا {foundCount} زبون غير مسحوبين. تريد نجيبهم هسه؟</span>
          <div className="flex gap-2">
            <button onClick={handleImport} className="bg-blue-600 text-white px-4 py-1 rounded-lg text-xs font-bold">جيب النواقص الآن</button>
            <button onClick={() => setStatus("idle")} className="text-gray-500 text-xs">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
