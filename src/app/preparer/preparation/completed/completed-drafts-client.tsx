"use client";

import { useActionState, useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deletePreparerShoppingDraftsAction } from "../../actions";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

type ProductRow = {
  line: string;
  buyAlf: number | "";
  sellAlf: number | "";
};

type SerializedDraft = {
  id: string;
  draftNumber: number;
  titleLine: string;
  status: string;
  customerName: string;
  customerRegionName: string;
  createdAt: string;
  updatedAt: string;
  data: any;
  sentOrderId?: string | null;
};

type Props = {
  initialDrafts: SerializedDraft[];
  auth: { p: string; exp: string; s: string };
  backHref: string;
  preparerName: string;
};

export function CompletedDraftsClient({ initialDrafts, auth, backHref, preparerName }: Props) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);

  const [deleteState, deleteAction, deletePending] = useActionState(deletePreparerShoppingDraftsAction, {});
  const [isPending, startTransition] = useTransition();

  // تصفية المسودات حسب البحث
  const filteredDrafts = useMemo(() => {
    return initialDrafts.filter((d) => {
      const numStr = String(d.draftNumber);
      const title = (d.titleLine || "").toLowerCase();
      const region = (d.customerRegionName || "").toLowerCase();
      const search = searchTerm.toLowerCase().trim();
      return numStr.includes(search) || title.includes(search) || region.includes(search);
    });
  }, [initialDrafts, searchTerm]);

  // فك محتويات المنتجات لكل مسودة وحساب الإجماليات
  const parsedDraftsData = useMemo(() => {
    return filteredDrafts.map((d) => {
      let products: ProductRow[] = [];
      if (d.data && typeof d.data === "object") {
        const productsRaw = d.data.products;
        if (Array.isArray(productsRaw)) {
          products = productsRaw.map((p: any) => ({
            line: String(p.line ?? "").trim(),
            buyAlf: p.buyAlf != null && p.buyAlf !== "" ? Number(p.buyAlf) : "",
            sellAlf: p.sellAlf != null && p.sellAlf !== "" ? Number(p.sellAlf) : "",
          }));
        }
      }

      // حساب إجمالي الشراء وإجمالي البيع والربح
      let totalBuyAlf = 0;
      let totalSellAlf = 0;
      products.forEach((p) => {
        if (typeof p.buyAlf === "number") totalBuyAlf += p.buyAlf;
        if (typeof p.sellAlf === "number") totalSellAlf += p.sellAlf;
      });

      const totalProfitAlf = totalSellAlf - totalBuyAlf;

      return {
        ...d,
        products,
        totalBuyAlf,
        totalSellAlf,
        totalProfitAlf,
      };
    });
  }, [filteredDrafts]);

  // إدارة التحديد
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredDrafts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDrafts.map((d) => d.id));
    }
  };

  // تنفيذ حذف المسودات المحددة (جماعياً أو فردياً)
  const handleDeleteDrafts = async (ids: string[]) => {
    if (ids.length === 0) return;
    const confirmMsg = ids.length === 1 
      ? "هل أنت متأكد من حذف هذا الطلب المكتمل نهائياً؟" 
      : `هل أنت متأكد من حذف ${ids.length} طلبات مكتملة نهائياً؟`;
      
    if (!window.confirm(confirmMsg)) return;

    const fd = new FormData();
    fd.append("p", auth.p);
    fd.append("exp", auth.exp);
    fd.append("s", auth.s);
    fd.append("draftIds", ids.join(","));

    startTransition(async () => {
      // استدعاء الأكشن
      const res = await deletePreparerShoppingDraftsAction({}, fd);
      if (res.ok) {
        setSelectedIds((prev) => prev.filter((x) => !ids.includes(x)));
        if (expandedDraftId && ids.includes(expandedDraftId)) {
          setExpandedDraftId(null);
        }
        router.refresh();
      } else if (res.error) {
        alert(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">📁 الطلبات المكتملة والمرفوعة</h1>
          <p className="mt-1 text-xs text-slate-500">مرحباً بك {preparerName}، هنا تجد مسودات التجهيز التي تم تسعيرها ورفعها للنظام.</p>
        </div>
        <Link
          href={backHref}
          className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-900"
        >
          ← العودة لوحة التجهيز
        </Link>
      </div>

      {/* شريط الأدوات والبحث */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
        <div className="relative flex-1 min-w-[260px]">
          <input
            type="text"
            placeholder="البحث برقم المسودة، العنوان، أو المنطقة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white dark:bg-slate-950 dark:border-slate-800 dark:text-white"
          />
          <span className="absolute left-auto right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              onClick={() => handleDeleteDrafts(selectedIds)}
              disabled={isPending || deletePending}
              className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
            >
              🗑️ حذف المحدد ({selectedIds.length})
            </button>
          )}
          
          <button
            onClick={toggleSelectAll}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          >
            {selectedIds.length === filteredDrafts.length && filteredDrafts.length > 0
              ? "إلغاء تحديد الكل"
              : "تحديد الكل"}
          </button>
        </div>
      </div>

      {/* رسالة الخطأ إن وجدت */}
      {deleteState.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950/20 dark:border-rose-900">
          ⚠️ {deleteState.error}
        </div>
      )}

      {/* قائمة المسودات المكتملة */}
      {parsedDraftsData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500 dark:border-slate-800">
          <p className="text-base font-bold">لا توجد طلبات مكتملة مطابقة للبحث حالياً.</p>
          <p className="mt-1 text-xs">الطلبات التي ترفعها بنجاح للمندوبين ستظهر هنا تلقائياً.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {parsedDraftsData.map((d) => {
            const isExpanded = expandedDraftId === d.id;
            const isSelected = selectedIds.includes(d.id);

            return (
              <div
                key={d.id}
                className={`overflow-hidden rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 ${
                  isSelected
                    ? "border-violet-500 ring-2 ring-violet-100 dark:ring-violet-950/30"
                    : "border-slate-100 hover:border-slate-300 dark:border-slate-800"
                }`}
              >
                {/* معلومات الطلب الأساسية */}
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(d.id)}
                      className="h-5 w-5 rounded-md border-slate-300 text-violet-600 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <div className="min-w-0 text-right">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                          #{d.draftNumber}
                        </span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                          {d.titleLine || "طلب بدون عنوان"}
                        </span>
                        <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-400">
                          {d.customerRegionName}
                        </span>
                        {d.status === "archived" && (
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                            مؤرشف (مرفوض)
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        تحديث: {new Date(d.updatedAt).toLocaleString("ar-IQ", { hour12: true })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedDraftId(isExpanded ? null : d.id)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    >
                      {isExpanded ? "إخفاء التفاصيل ⬆️" : "عرض المواد ⬇️"}
                    </button>
                    <button
                      onClick={() => handleDeleteDrafts([d.id])}
                      disabled={isPending}
                      className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400"
                      title="حذف هذا الطلب"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* تفاصيل المنتجات والأسعار */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/20">
                    <div className="mb-3 flex flex-wrap gap-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                      <div className="rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800">
                        شراء كلي: <span className="text-slate-900 dark:text-white">{formatDinarAsAlfWithUnit(d.totalBuyAlf)}</span>
                      </div>
                      <div className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                        بيع كلي: <span className="font-black text-violet-950 dark:text-violet-200">{formatDinarAsAlfWithUnit(d.totalSellAlf)}</span>
                      </div>
                      <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        صافي الربح: <span className="font-black text-emerald-950 dark:text-emerald-200">{formatDinarAsAlfWithUnit(d.totalProfitAlf)}</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 dark:border-slate-800">
                            <th className="pb-2 pt-1 font-bold">اسم المادة</th>
                            <th className="pb-2 pt-1 text-center font-bold">سعر الشراء</th>
                            <th className="pb-2 pt-1 text-center font-bold">سعر البيع</th>
                            <th className="pb-2 pt-1 text-left font-bold">الربح</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {d.products.map((p, idx) => {
                            const pBuy = typeof p.buyAlf === "number" ? p.buyAlf : 0;
                            const pSell = typeof p.sellAlf === "number" ? p.sellAlf : 0;
                            const pProfit = pSell - pBuy;

                            return (
                              <tr key={idx} className="text-slate-700 dark:text-slate-300">
                                <td className="py-2.5 font-medium">{p.line}</td>
                                <td className="py-2.5 text-center text-slate-500">
                                  {p.buyAlf !== "" ? formatDinarAsAlfWithUnit(p.buyAlf) : "—"}
                                </td>
                                <td className="py-2.5 text-center font-bold text-violet-700 dark:text-violet-400">
                                  {p.sellAlf !== "" ? formatDinarAsAlfWithUnit(p.sellAlf) : "—"}
                                </td>
                                <td className="py-2.5 text-left font-bold text-emerald-600 dark:text-emerald-400">
                                  {pProfit > 0 ? `+${formatDinarAsAlfWithUnit(pProfit)}` : formatDinarAsAlfWithUnit(pProfit)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
