"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportShopsButton() {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [report, setReport] = useState<any>(null);
  const router = useRouter();

  // 1. وظيفة تقرير النواقص (فحص فقط بدون نقل)
  async function generateMissingReport() {
    setStatus("loading");
    setCurrentStep("جاري فحص النواقص وإعداد التقرير...");
    try {
      const res = await fetch("/api/admin/import/shops/report");
      const data = await res.json();
      if (data.success) {
        setReport(data);
      } else {
        alert("⚠️ فشل في إعداد التقرير: " + data.message);
      }
    } catch (err: any) {
      alert("⚠️ خطأ: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  // 2. وظيفة إكمال المحلات الناقصة مع زبائنها
  async function importMissingShops() {
    if(!confirm("سيتم جلب المحلات وكل الزبائن التابعين لها من السيرفر القديم. هل أنت متأكد؟")) return;
    setStatus("loading");
    setProgress(0);
    try {
      let offset = 0;
      const limit = 5; // عدد قليل لضمان سحب الزبائن مع كل محل بدون مشاكل
      let isDone = false;
      let totalShops = 0;
      let totalCust = 0;

      while (!isDone) {
        setCurrentStep(`جاري سحب المحلات وزبائنها (${totalShops} محل، ${totalCust} زبون)...`);
        const res = await fetch("/api/admin/import/shops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit })
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.message);

        totalShops += data.shopsCount || 0;
        totalCust += data.customersCount || 0;

        offset += limit;
        isDone = data.done || offset >= 400; // فرضاً أن المحلات بحدود 400
        setProgress(Math.min(100, Math.round((offset / 334) * 100)));
        router.refresh();
      }
      alert(`✅ اكتملت المهمة!\nتم سحب ${totalShops} محل بنجاح.\nوتم ربط ${totalCust} زبون بمحلاتهم.`);
      window.location.reload();
    } catch (err: any) {
      alert("⚠️ حدث خطأ: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  // 3. وظيفة سحب الصور لـ R2
  async function syncPhotosToR2() {
    setStatus("loading");
    setProgress(0);
    try {
      let offset = 0;
      const limit = 10;
      let isDone = false;
      let totalSynced = 0;

      while (!isDone) {
        setCurrentStep(`📸 تأمين الصور على R2 (${offset}/334)...`);
        const res = await fetch("/api/admin/import/shops/sync-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit })
        });
        const data = await res.json();
        totalSynced += data.updated;
        offset += limit;
        isDone = data.done || offset >= 334;
        setProgress(Math.round((offset / 334) * 100));
      }
      alert(`✅ اكتمل تأمين ${totalSynced} صورة على R2.`);
      window.location.reload();
    } catch (err: any) {
      alert("⚠️ خطأ: " + err.message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex flex-wrap gap-3 items-center justify-end">
        {/* زر التقرير الجديد */}
        <button
          onClick={generateMissingReport}
          disabled={status === "loading"}
          className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-amber-600 disabled:bg-gray-400 transition-all text-sm"
        >
          🔍 فحص المفقودات (تقرير)
        </button>

        <button
          onClick={importMissingShops}
          disabled={status === "loading"}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 disabled:bg-gray-400 transition-all text-sm"
        >
          📥 جلب النواقص
        </button>

        <button
          onClick={syncPhotosToR2}
          disabled={status === "loading"}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-purple-700 disabled:bg-gray-400 transition-all text-sm"
        >
          📸 سحب الصور لـ R2
        </button>

        <button
          onClick={() => {
            if(confirm("سيتم مسح كافة المحلات، هل أنت متأكد؟")) {
              fetch("/api/admin/import/reset", { method: "POST" }).then(() => window.location.reload());
            }
          }}
          className="bg-red-50 text-red-500 px-3 py-2 rounded-lg font-bold border border-red-100 hover:bg-red-100 text-xs"
        >
          🗑️ مسح الكل
        </button>
      </div>

      {/* نافذة التقرير */}
      {report && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b bg-amber-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-amber-900">تقرير المحلات المفقودة</h3>
                <p className="text-sm text-amber-700">تم العثور على {report.missingCount} محل في القاعدة القديمة غير موجودة حالياً.</p>
              </div>
              <button onClick={() => setReport(null)} className="text-amber-900 font-bold hover:scale-110 transition-transform">✖</button>
            </div>

            <div className="p-6 overflow-y-auto bg-white space-y-3">
              {report.missingShops.length > 0 ? (
                report.missingShops.map((shop: any, i: number) => (
                  <div key={i} className="p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="font-bold text-slate-900">{shop.name}</div>
                    <div className="text-xs text-slate-500 flex gap-4 mt-1">
                      <span>👤 {shop.owner || "غير معروف"}</span>
                      <span>📞 {shop.phone || "بدون رقم"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-500 font-bold">✅ لا توجد محلات مفقودة، كل البيانات متزامنة!</div>
              )}
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setReport(null)} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {status === "loading" && (
        <div className="w-full bg-white p-4 rounded-xl border-2 border-indigo-100 shadow-xl animate-in fade-in zoom-in">
          <div className="flex justify-between mb-2">
            <span className="text-xs font-black text-indigo-700 uppercase tracking-tight">{currentStep}</span>
            <span className="text-xs font-black text-indigo-700">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200 shadow-inner">
            <div className="bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 h-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
