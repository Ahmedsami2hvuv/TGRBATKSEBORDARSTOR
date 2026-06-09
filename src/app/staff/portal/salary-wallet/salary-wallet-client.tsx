"use client";

import { useActionState, useState, useEffect } from "react";
import { createSalaryTransactionAction, withdrawSalaryAction, type SalaryActionState } from "./actions";
import { settleStaffProfit } from "../actions";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { StaffSubmittedClient } from "../submitted/staff-submitted-client";

const initial: SalaryActionState = {};

function toEnglishDigits(num: number | string): string {
  const str = typeof num === "number" ? num.toLocaleString("en-US") : String(num);
  return str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

export function SalaryWalletClient({
  staff,
  icons,
  authQ,
  se,
  exp,
  s,
  totalReceivedProfits,
  pendingOrders = [],
  submittedRows = [],
}: {
  staff: any;
  icons: GlobalIconsConfig | null;
  authQ: string;
  se: string;
  exp: string;
  s: string;
  totalReceivedProfits: number;
  pendingOrders?: any[];
  submittedRows?: any[];
}) {
  const [activeTab, setActiveTab] = useState<"status" | "submitted" | "receive" | "withdraw">("status");
  const [waPopupUrl, setWaPopupUrl] = useState<string | null>(null);

  const [receiveState, receiveAction, receivePending] = useActionState(createSalaryTransactionAction, initial);
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawSalaryAction, initial);
  const [settleState, settleAction, settlePending] = useActionState(settleStaffProfit, initial);

  // مراقبة نجاح المعاملات لفتح نافذة الواتساب
  useEffect(() => {
    if (receiveState.ok && receiveState.waUrl) {
      setWaPopupUrl(receiveState.waUrl);
      window.open(receiveState.waUrl, "_blank");
      // تصفير النموذج
      const form = document.getElementById("receive-form") as HTMLFormElement;
      if (form) form.reset();
    }
  }, [receiveState]);

  useEffect(() => {
    if (withdrawState.ok && withdrawState.waUrl) {
      setWaPopupUrl(withdrawState.waUrl);
      window.open(withdrawState.waUrl, "_blank");
      // تصفير النموذج
      const form = document.getElementById("withdraw-form") as HTMLFormElement;
      if (form) form.reset();
    }
  }, [withdrawState]);

  useEffect(() => {
    if (settleState.ok && settleState.waUrl) {
      setWaPopupUrl(settleState.waUrl);
      window.open(settleState.waUrl, "_blank");
    }
  }, [settleState]);

  const fixedSalary = Number(staff.fixedSalary || 0);
  const salaryBalance = Number(staff.salaryBalance || 0);
  // الراتب الكلي الحالي = المتبقي من الراتب + إجمالي أرباح المبيعات المستلمة
  const totalSalary = salaryBalance + totalReceivedProfits;

  return (
    <div className="space-y-6">
      {/* بطاقة الرصيد الرئيسية */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-700 p-6 text-white shadow-xl shadow-orange-100">
        <p className="text-xs font-black uppercase tracking-wider opacity-85">رصيد الراتب المتبقي بالإدارة</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-4xl font-black tabular-nums">{toEnglishDigits(salaryBalance)}</span>
          <span className="text-sm font-black opacity-80">د.ع</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-4 text-xs font-bold">
          <div>
            <p className="opacity-80">الراتب الثابت</p>
            <p className="mt-0.5 text-base font-black tabular-nums">{toEnglishDigits(fixedSalary)} د.ع</p>
          </div>
          <div>
            <p className="opacity-80">الراتب الكلي الحالي</p>
            <p className="mt-0.5 text-base font-black tabular-nums">{toEnglishDigits(totalSalary)} د.ع</p>
          </div>
        </div>
      </div>



      {settleState.error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <p className="text-xs font-bold">{settleState.error}</p>
        </div>
      )}

      {/* أزرار التبويب */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1.5 shadow-sm border border-slate-100 font-bold text-xs">
        <button
          onClick={() => setActiveTab("status")}
          className={`py-2 text-center rounded-xl transition ${
            activeTab === "status" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50 border border-slate-50"
          }`}
        >
          سجل المعاملات
        </button>
        <button
          onClick={() => setActiveTab("submitted")}
          className={`py-2 text-center rounded-xl transition ${
            activeTab === "submitted" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50 border border-slate-50"
          }`}
        >
          الطلبات المرفوعة ({submittedRows.length})
        </button>
        <button
          onClick={() => setActiveTab("receive")}
          className={`py-2 text-center rounded-xl transition ${
            activeTab === "receive" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50 border border-slate-50"
          }`}
        >
          تسجيل عمولة
        </button>
        <button
          onClick={() => setActiveTab("withdraw")}
          className={`py-2 text-center rounded-xl transition ${
            activeTab === "withdraw" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50 border border-slate-50"
          }`}
        >
          استلام راتب
        </button>
      </div>

      {/* محتوى التبويبات */}
      {activeTab === "status" && (
        <div className="space-y-4">

          <h2 className="text-sm font-bold text-slate-500 px-1">المعاملات الأخيرة</h2>
          {staff.staffTransactions.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center border border-slate-100">
              <p className="text-slate-400 font-bold text-sm">لا توجد معاملات مالية مسجلة بعد.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {staff.staffTransactions.map((t: any) => {
                let badgeColor = "bg-slate-100 text-slate-700";
                let typeText = "معاملة";
                let amountText = "";

                if (t.type === "receive_profit") {
                  badgeColor = "bg-emerald-50 text-emerald-700 border border-emerald-100";
                  typeText = "استلام عمولة مبيعات";
                  amountText = `+${toEnglishDigits(Number(t.profit))} د.ع (استقطاع: -${toEnglishDigits(Number(t.deduction))})`;
                } else if (t.type === "withdraw_salary") {
                  badgeColor = "bg-rose-50 text-rose-700 border border-rose-100";
                  typeText = "سحب راتب";
                  amountText = `-${toEnglishDigits(Number(t.amount))} د.ع`;
                } else if (t.type === "salary_addition") {
                  badgeColor = "bg-sky-50 text-sky-700 border border-sky-100";
                  typeText = "إيداع راتب شهري";
                  amountText = `+${toEnglishDigits(Number(t.amount))} د.ع`;
                }

                return (
                  <div key={t.id} className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badgeColor}`}>
                          {typeText}
                        </span>
                        <p className="text-sm font-black text-slate-800 mt-2">{t.details || "بدون تفاصيل"}</p>
                      </div>
                      <p className="text-sm font-black text-slate-900 tabular-nums">{amountText}</p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold pt-2 border-t border-slate-50">
                      <span>{toEnglishDigits(new Date(t.createdAt).toLocaleDateString("en-US", { dateStyle: "short" }))}</span>
                      {t.phone && <span>هاتف: {t.phone}</span>}
                    </div>

                    {t.imageUrl && (
                      <div className="mt-2">
                        <a
                          href={t.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-bold"
                        >
                          📎 عرض صورة الإيصال/المعاملة
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "receive" && (
        <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm">
          <h2 className="text-base font-black text-slate-900 mb-4">تسجيل عمولة مبيعات جديدة</h2>
          <form id="receive-form" action={receiveAction} className="space-y-4">
            <input type="hidden" name="se" value={se} />
            <input type="hidden" name="exp" value={exp} />
            <input type="hidden" name="s" value={s} />

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">نوع المعاملة *</label>
              <input
                name="details"
                required
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                placeholder="مثال: بيع ثلاجة"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">مبلغ الربح (العمولة) *</label>
              <input
                name="profit"
                type="number"
                required
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none tabular-nums"
                placeholder="مثال: 10000"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">رقم هاتف البائع *</label>
              <input
                name="phone"
                required
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                placeholder="مثال: 07700000000"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">صورة المعاملة/الإيصال (اختياري)</label>
              <input
                name="photo"
                type="file"
                accept="image/*"
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
              />
            </div>

            {receiveState.error && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {receiveState.error}
              </p>
            )}

            <button
              type="submit"
              disabled={receivePending}
              className="w-full rounded-2xl bg-amber-600 py-3.5 text-sm font-black text-white hover:bg-amber-700 transition active:scale-95 disabled:opacity-50"
            >
              {receivePending ? "جارٍ حفظ المعاملة والرفع..." : "تسجيل المعاملة ونقل للواتساب"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "withdraw" && (
        <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm">
          <h2 className="text-base font-black text-slate-900 mb-4">طلب سحب راتب (استلام الرصيد)</h2>
          <p className="text-xs text-slate-500 mb-4">
            الرصيد المتاح حالياً للسحب هو: <span className="font-black text-sky-700">{toEnglishDigits(salaryBalance)} د.ع</span>
          </p>

          <form id="withdraw-form" action={withdrawAction} className="space-y-4">
            <input type="hidden" name="se" value={se} />
            <input type="hidden" name="exp" value={exp} />
            <input type="hidden" name="s" value={s} />

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">المبلغ المطلوب سحبه (د.ع) *</label>
              <input
                name="withdrawAmount"
                type="number"
                required
                max={salaryBalance}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none tabular-nums"
                placeholder="مثال: 50000"
              />
            </div>

            {withdrawState.error && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
                {withdrawState.error}
              </p>
            )}

            <button
              type="submit"
              disabled={withdrawPending}
              className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white hover:bg-slate-800 transition active:scale-95 disabled:opacity-50"
            >
              {withdrawPending ? "جارٍ تسجيل السحب..." : "تسجيل السحب ونقل للواتساب"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "submitted" && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-500 px-1">سجل الطلبات المرفوعة الأخيرة</h2>
          {submittedRows.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center border border-slate-100">
              <p className="text-slate-400 font-bold text-sm">لا توجد طلبات مرفوعة حالياً.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submittedRows.map((order: any) => (
                <div key={order.id} className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        نوع الطلب: {order.type} {order.orderNumber}
                      </span>
                      {order.summary && (
                        <p className="text-xs font-bold text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                          {order.summary}
                        </p>
                      )}
                    </div>
                    {order.profit > 0 && (
                      <div className="text-left shrink-0">
                        <p className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                          الربح: {toEnglishDigits(order.profit)} د.ع
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-3 rounded-2xl text-[11px] font-bold text-slate-600 border border-slate-100/30">
                    <div>
                      <p className="text-[9px] text-slate-400">البائع والموقع</p>
                      <p className="mt-0.5 text-slate-800 truncate">{toEnglishDigits(order.sellerPhone)}</p>
                      <p className="text-slate-500 text-[10px] truncate">{order.sellerRegion}</p>
                    </div>
                    {order.buyerPhone && (
                      <div className="border-r border-slate-200/50 pr-4">
                        <p className="text-[9px] text-slate-400">المشتري والموقع</p>
                        <p className="mt-0.5 text-slate-800 truncate">{toEnglishDigits(order.buyerPhone)}</p>
                        <p className="text-slate-500 text-[10px] truncate">{order.buyerRegion}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[10px] text-slate-400">
                    <span>{toEnglishDigits(new Date(order.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" }))}</span>
                    <span className={`px-2 py-0.5 rounded-full font-black ${
                      order.status === "delivered" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                      order.status === "canceled" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                      "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      {order.status === "delivered" ? "تم التسليم" :
                       order.status === "canceled" ? "مسترجع/ملغي" :
                       order.status === "pending" ? "قيد الانتظار" : order.status}
                    </span>
                  </div>

                  {/* استلام أموالي إذا لم يتم تسويته والربح أكبر من 0 */}
                  {order.profit > 0 && !order.profitSettled && (
                    <div className="mt-2 bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3">
                      <p className="text-xs font-black text-emerald-850 mb-2">💰 استلام أرباح الطلب ({toEnglishDigits(order.profit)} د.ع)</p>
                      
                      <form action={settleAction} className="space-y-3">
                        <input type="hidden" name="se" value={se} />
                        <input type="hidden" name="exp" value={exp} />
                        <input type="hidden" name="s" value={s} />
                        <input type="hidden" name="orderId" value={order.id} />
                        
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 mb-1">يرجى إرفاق صورة الوصل لإتمام الاستلام *</label>
                          <input
                            name="photo"
                            type="file"
                            accept="image/*"
                            required
                            className="w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-white file:text-slate-700 hover:file:bg-slate-100 border border-slate-200/50 rounded-xl p-1 bg-white cursor-pointer"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={settlePending}
                          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-black text-white transition active:scale-95 disabled:opacity-50"
                        >
                          {settlePending ? "جاري تسجيل الاستلام..." : "تأكيد استلام أموالي"}
                        </button>
                      </form>
                    </div>
                  )}

                  {order.profitSettled && (
                    <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center justify-end gap-1">
                      <span>✅ تم استلام الأرباح وتسويتها</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
