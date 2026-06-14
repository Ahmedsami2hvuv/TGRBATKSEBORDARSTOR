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
            {partner.transactions.map((tx) => {
              const notesLower = tx.note?.toLowerCase() || "";
              const isSalary = notesLower.includes("[راتب]") || notesLower.includes("راتب");
              const isTransfer = notesLower.includes("تحويل");
              const isDebt = notesLower.includes("دين");

              let containerClasses = "";
              let tagClasses = "";
              let badgeText = "";
              let amountTextClass = "";

              if (isSalary) {
                containerClasses = "border-2 border-[#4f46e5] bg-gradient-to-r from-[#818cf8]/35 via-[#c7d2fe]/10 to-white hover:from-[#818cf8]/45 hover:via-[#c7d2fe]/20 hover:to-white/95 text-[#1e1b4b] ring-2 ring-[#4f46e5]/10";
                tagClasses = "bg-[#4f46e5] text-white border-[#4f46e5] font-black";
                badgeText = "💵 راتب";
                amountTextClass = "text-[#4f46e5]";
              } else if (isDebt) {
                containerClasses = "border-2 border-yellow-500 bg-gradient-to-r from-yellow-100/50 via-yellow-50/15 to-white text-yellow-950 ring-2 ring-yellow-400/10";
                tagClasses = "bg-yellow-600 text-white border-yellow-600 font-black";
                badgeText = "⚠️ دين";
                amountTextClass = "text-yellow-700";
              } else if (isTransfer) {
                containerClasses = "border-2 border-violet-700 bg-violet-600 text-white hover:bg-violet-650 ring-2 ring-violet-500/20";
                tagClasses = "bg-white/20 text-white border-white/25 font-black";
                badgeText = "🔄 تحويل";
                amountTextClass = "text-white";
              } else if (tx.kind === "gave") {
                containerClasses = "border-2 border-emerald-500 bg-gradient-to-r from-emerald-100/65 via-emerald-50/20 to-white hover:from-emerald-200/70 hover:via-emerald-50/30 hover:to-white/95 text-emerald-950 dark:text-emerald-300 ring-2 ring-emerald-400/20";
                tagClasses = "bg-emerald-600 text-white border-emerald-600 font-black shadow-sm";
                badgeText = "🟢 أعطيت";
                amountTextClass = "text-emerald-700";
              } else {
                containerClasses = "border-2 border-rose-500 bg-gradient-to-r from-rose-100/65 via-rose-50/20 to-white hover:from-rose-200/70 hover:via-rose-50/30 hover:to-white/95 text-rose-950 dark:text-red-350 ring-2 ring-rose-400/20";
                tagClasses = "bg-rose-600 text-white border-rose-600 font-black shadow-sm";
                badgeText = "🔴 أخذت";
                amountTextClass = "text-rose-700";
              }

              return (
                <div 
                  key={tx.id} 
                  className={`p-4 rounded-2xl transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${containerClasses}`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${tagClasses}`}>
                        {tx.isAuto ? `⚙️ تلقائي - ${badgeText.replace("🟢 ", "").replace("🔴 ", "")}` : badgeText}
                      </span>
                      <span className={`text-sm font-black tabular-nums ${amountTextClass}`}>
                        {formatDinarAsAlfWithUnit(tx.amount)}
                      </span>
                    </div>

                    <p className={`text-xs font-bold ${isTransfer ? "text-white/95" : "text-slate-700"}`}>
                      {tx.note || "بدون بيان وملاحظات"}
                    </p>
                    
                    {tx.imageUrl && (
                      <div className="mt-1 md:mt-0">
                        <img 
                          src={tx.imageUrl} 
                          alt="مرفق المعاملة" 
                          className={`max-h-12 rounded-lg object-contain border shadow-sm cursor-zoom-in ${isTransfer ? "border-white/20" : "border-slate-100"}`}
                          onClick={() => window.open(tx.imageUrl!, "_blank")}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto mt-2 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <span className={`text-[10px] font-medium ${isTransfer ? "text-violet-100/90" : "text-slate-400"}`}>
                      {new Date(tx.createdAt).toLocaleDateString("ar-EG")} {new Date(tx.createdAt).toLocaleTimeString("ar-EG", {hour: "2-digit", minute: "2-digit"})}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
