"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import {
  getTransactionLogs,
  restoreDeletedTransaction,
  revertModifiedTransaction,
  clearTransactionLogs
} from "../actions";

export default function CreditBookLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const history = await getTransactionLogs();
      setLogs(history);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleRestore = async (logId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في استعادة هذه المعاملة المحذوفة وإعادتها لحساب الشريك؟")) {
      return;
    }
    const res = await restoreDeletedTransaction(logId);
    if (res.success) {
      alert("تمت استعادة المعاملة بنجاح.");
      loadLogs();
    } else {
      alert(res.error || "فشلت استعادة المعاملة");
    }
  };

  const handleRevert = async (logId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في التراجع عن التعديل وإعادة هذه المعاملة لحالتها الأصلية؟")) {
      return;
    }
    const res = await revertModifiedTransaction(logId);
    if (res.success) {
      alert("تم إرجاع المعاملة لحالتها الأصلية بنجاح.");
      loadLogs();
    } else {
      alert(res.error || "فشل التراجع عن تعديل المعاملة");
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في مسح سجل التغييرات بالكامل؟ لا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }
    const res = await clearTransactionLogs();
    if (res.success) {
      alert("تم مسح السجل بنجاح.");
      setLogs([]);
    } else {
      alert(res.error || "فشل مسح السجل");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8" dir="rtl">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            href="/abo1stor3hlaa2kbr8-47/credit-book"
            className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 mb-2"
          >
            🔀 العودة لدفتر الديون
          </Link>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            📋 سجل المتغيرات والمعاملات المؤرشفة (المحذوفة والمعدلة)
          </h1>
        </div>

        {logs.length > 0 && (
          <button
            onClick={handleClearLogs}
            className="px-4 py-2.5 text-xs font-black text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl transition flex items-center gap-1.5"
          >
            🗑️ مسح السجل بالكامل
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm p-6 space-y-6">
        <p className="text-xs text-slate-500 font-bold bg-slate-50 p-4 rounded-2xl border border-slate-100">
          هنا يمكنك متابعة وتفقد كافة المعاملات المالية التي تم حذفها أو تعديلها يدوياً مع إمكانية التراجع والاسترجاع بنقرة زر.
        </p>

        {isLoadingLogs ? (
          <div className="text-center py-20 text-slate-400 font-bold text-sm">جاري تحميل سجل التغييرات...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold text-sm">لا توجد عمليات تعديل أو حذف مسجلة حالياً.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-black border-b border-slate-100">
                  <th className="p-4">نوع الإجراء</th>
                  <th className="p-4">اسم الحساب</th>
                  <th className="p-4">نوع المعاملة</th>
                  <th className="p-4">سعر المعاملة</th>
                  <th className="p-4">الملاحظات والبيان</th>
                  <th className="p-4">صورة المعاملة</th>
                  <th className="p-4">تاريخ المعاملة الأصلي</th>
                  <th className="p-4">تاريخ التغيير/المسح</th>
                  <th className="p-4 text-left">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log: any) => {
                  const isDeleted = log.type === "deleted";
                  const orig = log.originalTx;
                  const mod = log.modifiedTx;

                  const kindLabels: Record<string, string> = {
                    gave: "أعطيت (نطلبه)",
                    took: "أخذت (يطلبنا)"
                  };

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/30 transition text-sm">
                      <td className="p-4">
                        {isDeleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                            🗑️ معاملة محذوفة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200">
                            ✏️ معاملة معدلة
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-slate-800">{log.partnerName}</td>
                      <td className="p-4 font-semibold text-slate-600">
                        {isDeleted ? (
                          <span>{kindLabels[orig.kind] || orig.kind}</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {orig.kind === mod.kind ? (
                              <span>{kindLabels[orig.kind] || orig.kind}</span>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-slate-400 line-through">{kindLabels[orig.kind]}</span>
                                <span className="text-slate-400">➔</span>
                                <span className="text-indigo-600 font-bold">{kindLabels[mod.kind]}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-bold">
                        {isDeleted ? (
                          <span className="text-rose-600 tabular-nums">{formatDinarAsAlfWithUnit(orig.amount)}</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {orig.amount === mod.amount ? (
                              <span className="text-slate-700 tabular-nums">{formatDinarAsAlfWithUnit(orig.amount)}</span>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-slate-400 line-through tabular-nums">{formatDinarAsAlfWithUnit(orig.amount)}</span>
                                <span className="text-slate-400">➔</span>
                                <span className="text-indigo-600 font-bold tabular-nums">{formatDinarAsAlfWithUnit(mod.amount)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 text-xs max-w-xs truncate" title={orig.note || ""}>
                        {isDeleted ? (
                          <span>{orig.note || "—"}</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {orig.note === mod.note ? (
                              <span>{orig.note || "—"}</span>
                            ) : (
                              <div className="space-y-0.5 text-[11px]">
                                <div className="text-slate-400 line-through truncate">{orig.note || "—"}</div>
                                <div className="text-indigo-600 font-bold truncate">{mod.note || "—"}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {orig.imageUrl ? (
                          <a
                            href={orig.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block border border-slate-200 rounded-lg p-0.5 bg-slate-50 hover:bg-slate-100 transition"
                          >
                            <img
                              src={orig.imageUrl}
                              alt="معاملة"
                              className="w-10 h-10 object-cover rounded-md"
                            />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 text-xs tabular-nums">
                        {new Date(orig.createdAt).toLocaleString("ar-EG")}
                      </td>
                      <td className="p-4 text-slate-500 text-xs tabular-nums">
                        <div>{new Date(log.timestamp).toLocaleString("ar-EG")}</div>
                        <div className="text-[10px] text-indigo-600 font-bold mt-0.5">بواسطة: {log.performedBy || "الإدارة"}</div>
                      </td>
                      <td className="p-4 text-left">
                        {isDeleted ? (
                          <button
                            type="button"
                            onClick={() => handleRestore(log.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm"
                            title="إعادة هذه المعاملة المحذوفة إلى حساب الشريك"
                          >
                            🔄 إرجاع للحساب
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRevert(log.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm"
                            title="التراجع عن التعديل وإرجاع قيم المعاملة لما قبل التعديل"
                          >
                            ↩️ إرجاع للأصلية
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
