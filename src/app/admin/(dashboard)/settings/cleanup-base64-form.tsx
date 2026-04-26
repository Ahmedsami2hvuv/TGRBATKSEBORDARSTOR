"use client";

import { useState } from "react";
import { cleanupBase64Images } from "@/lib/cleanup-actions";

export function CleanupBase64Form() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

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
        onClick={handleCleanup}
        disabled={loading}
        className="w-full md:w-auto px-6 py-2.5 bg-rose-600 text-white font-black rounded-xl hover:bg-rose-700 transition disabled:opacity-50 shadow-sm"
      >
        {loading ? "جاري المسح والتنظيف..." : "ابدأ تنظيف قاعدة البيانات الآن"}
      </button>

      {result?.success && (
        <p className="text-xs font-bold text-emerald-600">✓ تم التنظيف بنجاح!</p>
      )}
    </div>
  );
}
