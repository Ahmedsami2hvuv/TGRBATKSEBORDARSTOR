"use client";

import { useState } from "react";
import {
  cleanupBase64Images,
  migrateBase64ImagesToR2,
  repairBrokenUploadsUrlsBatch,
} from "@/lib/cleanup-actions";

export function CleanupBase64Form() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; message?: string } | null>(null);
  const [repairResult, setRepairResult] = useState<{
    success?: boolean;
    message?: string;
    scanned?: number;
    fixed?: number;
    unresolved?: number;
  } | null>(null);

  async function handleMigrateToR2() {
    if (!confirm("سيتم تحويل صور Base64 القديمة إلى R2 أولاً. تريد المتابعة؟")) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await migrateBase64ImagesToR2();
      setResult({ success: res.success, message: res.message });
      if (res.success) {
        alert(`${res.message}\nالمفحوص: ${res.scanned}\nالفاشل: ${res.failed}`);
      } else {
        alert(res.message || "فشلت عملية تحويل الصور إلى R2.");
      }
    } catch (err) {
      console.error(err);
      setResult({ error: "حدث خطأ أثناء التحويل" });
      alert("فشلت عملية تحويل الصور إلى R2، يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanup() {
    if (!confirm("هل أنت متأكد؟ سيتم حذف جميع الصور القديمة المخزنة في قاعدة البيانات نهائياً لتوفير المساحة. لا يمكن التراجع عن هذه العملية!")) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await cleanupBase64Images();
      setResult(res);
      alert("تمت عملية التنظيف بنجاح! قاعدة البيانات الآن أخف بكثير.");
    } catch (err) {
      console.error(err);
      setResult({ error: "حدث خطأ أثناء التنظيف" });
      alert("فشلت عملية التنظيف، يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRepairBrokenUrls() {
    if (!confirm("سيتم فحص دفعة كبيرة من روابط الصور ومحاولة إصلاح المكسور تلقائياً. المتابعة؟")) {
      return;
    }

    setLoading(true);
    setRepairResult(null);

    try {
      const res = await repairBrokenUploadsUrlsBatch(1200);
      setRepairResult(res);
      alert(`${res.message}\nتم الفحص: ${res.scanned}\nتم الإصلاح: ${res.fixed}\nغير المحلول: ${res.unresolved}`);
    } catch (err) {
      console.error(err);
      setRepairResult({ success: false, message: "حدث خطأ أثناء إصلاح الروابط." });
      alert("فشلت عملية إصلاح الروابط، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-4 bg-rose-50 rounded-2xl border border-rose-100">
      <div>
        <h4 className="text-sm font-black text-rose-900 mb-1">تنظيف الصور القديمة (Base64) 🧹</h4>
        <p className="text-xs text-rose-700 leading-relaxed font-bold">
          هذا الخيار سيقوم بمسح كافة الصور المخزنة "داخل" قاعدة البيانات والتي تسبب ثقلاً في النظام.
          الصور الجديدة المرفوعة على Cloudflare لن تتأثر.
        </p>
      </div>

      <button
        onClick={handleMigrateToR2}
        disabled={loading}
        className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
      >
        {loading ? "جاري تحويل الصور..." : "تحويل صور Base64 إلى R2"}
      </button>

      <button
        onClick={handleRepairBrokenUrls}
        disabled={loading}
        className="w-full md:w-auto px-6 py-2.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 shadow-sm"
      >
        {loading ? "جاري إصلاح الروابط..." : "إصلاح روابط الصور المكسورة (دفعة كبيرة)"}
      </button>

      <button
        onClick={handleCleanup}
        disabled={loading}
        className="w-full md:w-auto px-6 py-2.5 bg-rose-600 text-white font-black rounded-xl hover:bg-rose-700 transition disabled:opacity-50 shadow-sm"
      >
        {loading ? "جاري المسح والتنظيف..." : "تنظيف الصور القديمة من قاعدة البيانات"}
      </button>

      {result?.success && (
        <p className="text-xs font-bold text-emerald-600">✓ {result.message || "تمت العملية بنجاح!"}</p>
      )}
      {repairResult?.message && (
        <p className={`text-xs font-bold ${repairResult.success ? "text-emerald-600" : "text-rose-600"}`}>
          {repairResult.success ? "✓ " : "✗ "}
          {repairResult.message}
        </p>
      )}
    </div>
  );
}
