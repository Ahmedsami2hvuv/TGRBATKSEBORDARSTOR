"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export function ReportTableClient({ orders }: { orders: any[] }) {
  const [viewMode, setViewMode] = useState<"general" | "meat" | "fish">("general");
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // تصفية العرض بناءً على الزر المختار (عام، لحم، سمك)
  const displayedOrders = 
    viewMode === "general" ? orders : 
    viewMode === "meat" ? orders.filter(o => o.hasMeat) :
    orders.filter(o => o.hasFish);

  return (
    <>
      {/* أزرار التبديل بين التقارير */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button 
          onClick={() => setViewMode("general")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${viewMode === "general" ? "bg-slate-900 text-white shadow-lg" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
        >
          📑 تقرير عام
        </button>
        <button 
          onClick={() => setViewMode("meat")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${viewMode === "meat" ? "bg-red-700 text-white shadow-lg scale-105" : "bg-white border border-red-200 text-red-600 hover:bg-red-50"}`}
        >
          🥩 اللحوم (القصاب)
        </button>
        <button 
          onClick={() => setViewMode("fish")}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all ${viewMode === "fish" ? "bg-sky-700 text-white shadow-lg scale-105" : "bg-white border border-sky-200 text-sky-600 hover:bg-sky-50"}`}
        >
          🐟 الأسماك (السماك)
        </button>
      </div>

      {/* الجدول الرئيسي */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-right text-sm">
          <thead className={`${viewMode === 'meat' ? 'bg-red-50' : viewMode === 'fish' ? 'bg-sky-50' : 'bg-slate-50'} text-[10px] font-black text-slate-500 border-b border-slate-200`}>
            <tr>
              <th className="px-4 py-4">رقم الطلب</th>
              <th className="px-4 py-4">المنطقة</th>
              {viewMode === "general" ? (
                <>
                  <th className="px-4 py-4 text-center">المواد</th>
                  <th className="px-4 py-4 text-center font-black">صافي الربح</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-4 text-center">شراء</th>
                  <th className="px-4 py-4 text-center">بيع</th>
                  <th className="px-4 py-4 text-center font-black">صافي الربح</th>
                </>
              )}
              <th className="px-4 py-4 text-left">المحل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedOrders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-bold italic">لا توجد بيانات لهذا التصنيف اليوم.</td></tr>
            ) : (
              displayedOrders.map((order) => (
                <tr 
                  key={order.orderId} 
                  onClick={() => setSelectedOrder(order)}
                  className={`cursor-pointer transition-colors ${viewMode === "meat" ? "hover:bg-red-50" : viewMode === "fish" ? "hover:bg-sky-50" : "hover:bg-slate-50"} bg-white`}
                >
                  <td className="px-4 py-4 font-black text-sky-700 underline underline-offset-4 decoration-dotted">#{order.orderNumber}</td>
                  <td className="px-4 py-4 font-bold text-slate-800">{order.regionName}</td>
                  
                  {viewMode === "general" ? (
                    <>
                      <td className="px-4 py-4 text-center tabular-nums font-semibold">{order.productCount}</td>
                      <td className="px-4 py-4 text-center font-mono font-black text-emerald-600">
                        {formatDinarAsAlfWithUnit(order.totalProfitAlf)}
                      </td>
                    </>
                  ) : viewMode === "meat" ? (
                    <>
                      <td className="px-4 py-4 text-center font-mono font-bold text-red-800">{order.meatBuyAlf} </td>
                      <td className="px-4 py-4 text-center font-mono font-bold text-emerald-800">{order.meatSellAlf} </td>
                      <td className="px-4 py-4 text-center font-mono font-black text-red-950 bg-red-100/30">
                        {formatDinarAsAlfWithUnit(order.meatProfitAlf)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-4 text-center font-mono font-bold text-sky-800">{order.fishBuyAlf} </td>
                      <td className="px-4 py-4 text-center font-mono font-bold text-emerald-800">{order.fishSellAlf} </td>
                      <td className="px-4 py-4 text-center font-mono font-black text-sky-950 bg-sky-100/30">
                        {formatDinarAsAlfWithUnit(order.fishProfitAlf)}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-4 text-left text-[10px] font-bold text-slate-400">{order.shopName}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* نافذة الفاتورة المنبثقة (Modal) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedOrder(null)}>
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border-2 border-slate-200" onClick={e => e.stopPropagation()}>
            {/* رأس النافذة */}
            <div className={`${viewMode === 'meat' ? 'bg-red-700' : viewMode === 'fish' ? 'bg-sky-700' : 'bg-slate-900'} text-white px-6 py-4 flex justify-between items-center shadow-lg`}>
              <div>
                <h3 className="text-lg font-black italic">
                  {viewMode === "meat" ? "🥩 فاتورة اللحوم" : viewMode === "fish" ? "🐟 فاتورة الأسماك" : "🧾 الفاتورة الكاملة"} #{selectedOrder.orderNumber}
                </h3>
                <p className="text-[10px] text-white/70 font-bold mt-1">{selectedOrder.regionName}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-black">✕</button>
            </div>

            {/* محتوى الفاتورة - قائمة المواد */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="w-full text-right text-sm">
                <thead className="text-slate-400 border-b border-slate-100 font-bold text-xs">
                  <tr>
                    <th className="py-2">المادة</th>
                    <th className="py-2 text-center">شراء</th>
                    <th className="py-2 text-center">بيع</th>
                    <th className="py-2 text-center font-black">ربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(viewMode === "meat" ? selectedOrder.meatProductsList : viewMode === "fish" ? selectedOrder.fishProductsList : selectedOrder.preparerShoppingJson.products).map((p: any, i: number) => {
                    const buy = Number(p.buyAlf) || 0;
                    const sell = Number(p.sellAlf) || 0;
                    return (
                      <tr key={i} className={viewMode === 'meat' ? 'bg-red-50/10' : viewMode === 'fish' ? 'bg-sky-50/10' : ''}>
                        <td className="py-4 font-black text-slate-800">{p.line}</td>
                        <td className="py-4 text-center font-mono font-bold text-slate-600">{buy}</td>
                        <td className="py-4 text-center font-mono font-bold text-slate-900">{sell}</td>
                        <td className="py-4 text-center font-mono font-black text-emerald-600">{(sell - buy).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* تذييل النافذة - الأرباح والأزرار */}
            <div className={`${viewMode === 'meat' ? 'bg-red-900' : viewMode === 'fish' ? 'bg-sky-900' : 'bg-emerald-900'} text-white p-6 flex flex-col gap-3 shadow-inner`}>
              <div className="flex justify-between items-center w-full mb-2">
                <span className="text-lg font-bold">صافي الربح المستخلص:</span>
                <span className="text-3xl font-black tabular-nums">
                  {formatDinarAsAlfWithUnit(viewMode === "meat" ? selectedOrder.meatProfitAlf : viewMode === "fish" ? selectedOrder.fishProfitAlf : selectedOrder.totalProfitAlf)}
                </span>
              </div>
              
              {/* أزرار الإجراءات */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                   href={`${SECRET_ADMIN_PATH}/orders/${selectedOrder.orderId}?pricing=1`}
                   className="bg-white text-slate-900 text-center py-3.5 rounded-2xl font-black text-sm shadow-xl hover:bg-amber-50 transition-all active:scale-95 border-b-4 border-slate-200"
                >
                  💰 تعديل أسعار المنتجات
                </Link>
                <Link
                   href={`${SECRET_ADMIN_PATH}/orders/${selectedOrder.orderId}/edit`}
                   className="bg-slate-800/50 text-white text-center py-3.5 rounded-2xl font-black text-sm shadow-xl hover:bg-slate-700 transition-all active:scale-95 border border-white/20"
                >
                  ✏️ تعديل بيانات الطلب العامة
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
