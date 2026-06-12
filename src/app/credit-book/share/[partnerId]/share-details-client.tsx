"use client";

import React from "react";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";

interface Transaction {
  id: string;
  partnerId: string;
  amount: number;
  kind: string; // "gave" or "took"
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  isAuto?: boolean;
  isPaid?: boolean;
  remainingAmount?: number;
  isAdminPayment?: boolean;
}

interface Partner {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  externalId: string | null;
  createdAt: Date;
  balance: number;
  manualBalance: number;
  autoBalance: number;
  totalGave: number;
  totalTook: number;
  transactions: Transaction[];
  walletRemain?: number;
}

interface ShareDetailsClientProps {
  partner: Partner;
}

export function ShareDetailsClient({ partner }: ShareDetailsClientProps) {
  return (
    <div className="space-y-8 text-right" dir="rtl">
      {/* هيدر كرت تفاصيل الشريك والورصيد */}
      <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-right flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-800">{partner.name}</h2>
          <p className="text-sm text-slate-500 font-bold mt-1.5">كشف الحساب والمعاملات</p>
          <p className="text-xs text-slate-400 font-medium mt-1">تاريخ الاستخراج: {new Date().toLocaleDateString("ar-EG")}</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl text-left">
            <span className="text-[10px] font-black text-slate-400">إجمالي أعطيت</span>
            <p className="text-sm font-black text-emerald-600 tabular-nums">{formatDinarAsAlfWithUnit(partner.totalGave)}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl text-left">
            <span className="text-[10px] font-black text-slate-400">إجمالي أخذت</span>
            <p className="text-sm font-black text-rose-600 tabular-nums">{formatDinarAsAlfWithUnit(partner.totalTook)}</p>
          </div>
          <div className={`px-5 py-2.5 rounded-2xl text-left border ${
            partner.balance >= 0 
              ? "bg-emerald-50 border-emerald-100 text-emerald-950" 
              : "bg-rose-50 border-rose-100 text-rose-950"
          }`}>
            <span className="text-[10px] font-black opacity-60">الرصيد المتبقي الإجمالي</span>
            <p className="text-base font-black tabular-nums">
              {partner.balance > 0 ? "المطلوب سداده: " : partner.balance < 0 ? "مستحق لكم: " : ""}
              {formatDinarAsAlfWithUnit(Math.abs(partner.balance))}
            </p>
          </div>
        </div>
      </div>

      {/* كشف الحساب وتفاصيل المعاملات التاريخية */}
      <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-right space-y-6">
        <h3 className="text-md font-black text-slate-800">📄 كشف المعاملات التفصيلي (للقراءة فقط)</h3>

        {partner.transactions.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold">لا يوجد أي معاملات مالية مسجلة في هذا الحساب.</div>
        ) : (
          <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
            {partner.transactions.map((tx) => (
              <div 
                key={tx.id} 
                className={`p-4 rounded-2xl border transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                  tx.isAuto 
                    ? "bg-slate-50 border-slate-200 hover:bg-slate-100/70"
                    : tx.kind === "gave"
                      ? "bg-emerald-50/20 border-emerald-100 hover:bg-emerald-50/30"
                      : "bg-rose-50/20 border-rose-100 hover:bg-rose-50/30"
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                      tx.isAuto 
                        ? "bg-indigo-100 text-indigo-800"
                        : tx.kind === "gave"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                    }`}>
                      {tx.isAuto ? "⚙️ تلقائي" : tx.kind === "gave" ? "🟢 أعطيت" : "🔴 أخذت"}
                    </span>
                    <span className={`text-sm font-black tabular-nums ${
                      tx.kind === "gave" ? "text-emerald-700" : "text-rose-700"
                    }`}>
                      {formatDinarAsAlfWithUnit(tx.amount)}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-slate-700">{tx.note || "بدون بيان وملاحظات"}</p>
                  
                  {tx.imageUrl && (
                    <div className="mt-1 md:mt-0">
                      <img 
                        src={tx.imageUrl} 
                        alt="مرفق المعاملة" 
                        className="max-h-12 rounded-lg object-contain border border-slate-100 shadow-sm cursor-zoom-in"
                        onClick={() => window.open(tx.imageUrl!, "_blank")}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(tx.createdAt).toLocaleDateString("ar-EG")} {new Date(tx.createdAt).toLocaleTimeString("ar-EG", {hour: "2-digit", minute: "2-digit"})}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
