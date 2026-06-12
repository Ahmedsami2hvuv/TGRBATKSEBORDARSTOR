"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  addTransaction, 
  updateTransaction, 
  deleteTransaction, 
  deletePartner, 
  getPartnerDetails,
  payShopOrderFromAdmin,
  uploadTransactionImage,
  updateAdminPaymentEvent,
  deleteAdminPaymentEvent,
  zeroPartnerAccount
} from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/credit-book/actions";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { useRouter } from "next/navigation";

// تعريف الواجهات البرمجية
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

interface PartnerDetailsClientProps {
  partner: Partner;
}

export function PartnerDetailsClient({ partner: initialPartner }: PartnerDetailsClientProps) {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner>(initialPartner);
  
  // نموذج إضافة معاملة
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"gave" | "took">("gave");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  // نموذج تعديل معاملة
  const [editTxId, setEditTxId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editKind, setEditKind] = useState<"gave" | "took">("gave");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // نموذج تعديل دفعة الإدارة
  const [editAdminPaymentId, setEditAdminPaymentId] = useState<string | null>(null);
  const [editAdminPaymentAmount, setEditAdminPaymentAmount] = useState("");
  const [isEditingAdminPayment, setIsEditingAdminPayment] = useState(false);

  const handleStartEditAdminPayment = (tx: Transaction) => {
    setEditAdminPaymentId(tx.id.replace("auto-payment-", ""));
    setEditAdminPaymentAmount(tx.amount.toString());
  };

  const handleUpdateAdminPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(editAdminPaymentAmount.replace(/,/g, ""));
    if (isNaN(numAmt) || numAmt <= 0) {
      alert("الرجاء إدخال مبلغ صحيح");
      return;
    }
    setIsEditingAdminPayment(true);
    const res = await updateAdminPaymentEvent(editAdminPaymentId!, numAmt);
    setIsEditingAdminPayment(false);
    if (res.success) {
      setEditAdminPaymentId(null);
      refreshPartnerData();
    } else {
      alert(res.error || "حدث خطأ أثناء تعديل الدفعة");
    }
  };

  const handleDeleteAdminPayment = async (txId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف دفعة الإدارة هذه؟")) {
      return;
    }
    const eventId = txId.replace("auto-payment-", "");
    const res = await deleteAdminPaymentEvent(eventId);
    if (res.success) {
      refreshPartnerData();
    } else {
      alert(res.error || "فشل حذف الدفعة");
    }
  };

  // تحديث البيانات من السيرفر
  const refreshPartnerData = async () => {
    const updated = await getPartnerDetails(partner.id);
    if (updated) {
      setPartner(updated);
      router.refresh();
    }
  };

  // تسجيل دفع من الإدارة للطلبات التلقائية للمحلات
  const handleAdminPayOrder = async (tx: Transaction) => {
    const orderId = tx.id.replace("auto-order-", "");
    const confirmPay = confirm(`هل أنت متأكد من رغبتك في تسجيل عملية دفع لهذا الطلب بقيمة ${formatDinarAsAlfWithUnit(tx.amount)} من طرف الإدارة مباشرة؟`);
    if (!confirmPay) return;

    const res = await payShopOrderFromAdmin(orderId, tx.amount);
    if (res.success) {
      alert("تم تسجيل عملية الدفع للطلب بنجاح!");
      refreshPartnerData();
    } else {
      alert(res.error || "حدث خطأ أثناء تسجيل عملية الدفع");
    }
  };

  // تسجيل معاملة جديدة
  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(amount.replace(/,/g, ""));
    if (isNaN(numAmt) || numAmt <= 0) {
      setError("الرجاء إدخال مبلغ صحيح أكبر من الصفر");
      return;
    }

    setIsAdding(true);
    setError("");

    let uploadedUrl: string | null = null;
    if (imageFile) {
      const formData = new FormData();
      formData.append("image", imageFile);
      const uploadRes = await uploadTransactionImage(formData);
      if (uploadRes.success) {
        uploadedUrl = uploadRes.url;
      } else {
        setError(uploadRes.error || "فشل تحميل الصورة");
        setIsAdding(false);
        return;
      }
    }

    const selectedDate = date ? new Date(date) : undefined;
    const res = await addTransaction(partner.id, numAmt, kind, note, selectedDate, uploadedUrl);
    setIsAdding(false);

    if (res.success) {
      setAmount("");
      setNote("");
      setDate("");
      setImageFile(null);
      const fileInput = document.getElementById("tx-image-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      refreshPartnerData();
    } else {
      setError(res.error || "حدث خطأ ما");
    }
  };

  // معالجة تعديل معاملة
  const handleStartEdit = (tx: Transaction) => {
    if (tx.isAuto) return;
    setEditTxId(tx.id);
    setEditAmount(tx.amount.toString());
    setEditKind(tx.kind as "gave" | "took");
    setEditNote(tx.note || "");
    // تحويل التاريخ ليكون متوافقاً مع حقل التاريخ في html
    const txDate = new Date(tx.createdAt);
    const localDateStr = txDate.toISOString().substring(0, 10);
    setEditDate(localDateStr);
  };

  const handleUpdateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(editAmount.replace(/,/g, ""));
    if (isNaN(numAmt) || numAmt <= 0) {
      alert("الرجاء إدخال مبلغ صحيح");
      return;
    }

    setIsEditing(true);
    const selectedDate = editDate ? new Date(editDate) : undefined;
    const res = await updateTransaction(editTxId!, numAmt, editNote, editKind, selectedDate);
    setIsEditing(false);

    if (res.success) {
      setEditTxId(null);
      refreshPartnerData();
    } else {
      alert(res.error || "حدث خطأ أثناء التعديل");
    }
  };

  // حذف معاملة
  const handleDeleteTx = async (txId: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذه المعاملة المالية؟")) {
      return;
    }
    const res = await deleteTransaction(txId);
    if (res.success) {
      refreshPartnerData();
    } else {
      alert(res.error || "فشل حذف المعاملة");
    }
  };

  // حذف الشريك بالكامل
  const handleDeletePartner = async () => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف الشريك "${partner.name}" بالكامل مع جميع معاملاته المالية المسجلة؟`)) {
      return;
    }
    const res = await deletePartner(partner.id);
    if (res.success) {
      router.push("/abo1stor3hlaa2kbr8-47/credit-book");
      router.refresh();
    } else {
      alert(res.error || "فشل حذف الشريك");
    }
  };

  // تصفير وتصفية حساب الشريك
  const handleZeroAccount = async () => {
    if (partner.balance === 0) {
      alert("الحساب مصفّر بالفعل!");
      return;
    }

    const confirmZero = confirm(`هل أنت متأكد من رغبتك في تصفير حساب الشريك "${partner.name}" بقيمة ${formatDinarAsAlfWithUnit(Math.abs(partner.balance))}؟ سيقوم النظام بتسديد كافة المعاملات والطلبات غير المدفوعة وتصفية الرصيد بالكامل.`);
    if (!confirmZero) return;

    setIsAdding(true);
    const res = await zeroPartnerAccount(partner.id);
    setIsAdding(false);

    if (res.success) {
      alert("تم تصفير الحساب وتصفية جميع الديون والطلبات المرتبطة به بنجاح!");
      refreshPartnerData();
    } else {
      alert(res.error || "حدث خطأ أثناء تصفير الحساب");
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* هيدر كرت تفاصيل الشريك والورصيد */}
      <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-right flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-800">{partner.name}</h2>
          <p className="text-sm text-slate-500 font-bold mt-1">رقم الهاتف: {partner.phone || "غير متوفر"}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">تاريخ الإنشاء: {new Date(partner.createdAt).toLocaleDateString("ar-EG")}</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl text-left">
            <span className="text-[10px] font-black text-slate-400">إجمالي أعطيت (نطلبه)</span>
            <p className="text-sm font-black text-emerald-600 tabular-nums">{formatDinarAsAlfWithUnit(partner.totalGave)}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl text-left">
            <span className="text-[10px] font-black text-slate-400">إجمالي أخذت (يطلبنا)</span>
            <p className="text-sm font-black text-rose-600 tabular-nums">{formatDinarAsAlfWithUnit(partner.totalTook)}</p>
          </div>
          {(partner.type === "courier" || partner.type === "preparer") && (
            <div className="bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl text-left">
              <span className="text-[10px] font-black text-indigo-500">متبقي المحفظة للإدارة</span>
              <p className="text-sm font-black text-indigo-700 tabular-nums">{formatDinarAsAlfWithUnit(partner.walletRemain || 0)}</p>
            </div>
          )}
          <div className={`px-5 py-2.5 rounded-2xl text-left border ${
            partner.balance >= 0 
              ? "bg-emerald-50 border-emerald-100 text-emerald-950" 
              : "bg-rose-50 border-rose-100 text-rose-950"
          }`}>
            <span className="text-[10px] font-black opacity-60">الرصيد الإجمالي الحالي</span>
            <p className="text-base font-black tabular-nums">
              {partner.balance > 0 ? "نطلبه: " : partner.balance < 0 ? "يطلبنا: " : ""}
              {formatDinarAsAlfWithUnit(Math.abs(partner.balance))}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* نموذج إضافة معاملة جديدة */}
        <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-right h-fit">
          <h3 className="text-md font-black text-slate-800 mb-4">✍️ تسجيل معاملة يدوية جديدة</h3>
          <form onSubmit={handleAddTx} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">قيمة المبلغ</label>
              <input
                type="text"
                required
                placeholder="مثال: 50,000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:indigo-500 text-left"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">نوع المعاملة</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKind("gave")}
                  className={`py-2 text-xs font-black rounded-xl border text-center transition ${
                    kind === "gave"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🟢 أعطيت (نطلبه / سلفة)
                </button>
                <button
                  type="button"
                  onClick={() => setKind("took")}
                  className={`py-2 text-xs font-black rounded-xl border text-center transition ${
                    kind === "took"
                      ? "bg-rose-50 border-rose-300 text-rose-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🔴 أخذت (يطلبنا / تسديد)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">تاريخ المعاملة (اختياري)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:indigo-500 text-right bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">بيان أو ملاحظات</label>
              <textarea
                placeholder="تفاصيل المعاملة..."
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:indigo-500 text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">إرفاق صورة المعاملة (اختياري)</label>
              <input
                id="tx-image-input"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImageFile(file);
                }}
                className="w-full px-4 py-2 rounded-2xl border border-slate-200 text-sm focus:outline-none bg-white text-right"
              />
            </div>

            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={isAdding}
              className="w-full px-4 py-3 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition disabled:opacity-50 shadow-md shadow-indigo-900/10"
            >
              {isAdding ? "جاري الحفظ..." : "حفظ المعاملة بالدفتر"}
            </button>
          </form>

          {/* أزرار تصفير الحساب وحذف الحساب */}
          <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
            {partner.balance !== 0 && (
              <button
                onClick={handleZeroAccount}
                className="w-full px-4 py-2.5 text-xs font-black text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-2xl transition text-center"
              >
                🧹 تصفير الحساب بالكامل
              </button>
            )}
            <button
              onClick={handleDeletePartner}
              className="w-full px-4 py-2.5 text-xs font-black text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-2xl transition text-center"
            >
              🗑️ حذف هذا الحساب بالكامل
            </button>
          </div>
        </div>

        {/* كشف الحساب وتفاصيل المعاملات التاريخية */}
        <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-right lg:col-span-2 space-y-6">
          <h3 className="text-md font-black text-slate-800">📄 كشف المعاملات التاريخية</h3>

          {partner.transactions.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-bold">لا يوجد أي معاملات مالية مسجلة لهذا الحساب.</div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {partner.transactions.map((tx) => (
                <div 
                  key={tx.id} 
                  className={`p-4 rounded-2xl border transition ${
                    tx.isAuto 
                      ? "bg-slate-50 border-slate-200 hover:bg-slate-100/70"
                      : tx.kind === "gave" 
                        ? "bg-emerald-50/20 border-emerald-100 hover:bg-emerald-50/30" 
                        : "bg-rose-50/20 border-rose-100 hover:bg-rose-50/30"
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        tx.isAuto 
                          ? "bg-indigo-100 text-indigo-800"
                          : tx.kind === "gave" 
                            ? "bg-emerald-100 text-emerald-800" 
                            : "bg-rose-100 text-rose-800"
                      }`}>
                        {tx.isAuto 
                          ? "⚙️ تلقائي من النظام" 
                          : tx.kind === "gave" ? "🟢 أعطيت (نطلبه)" : "🔴 أخذت (يطلبنا)"}
                      </span>
                      <p className="text-sm font-bold text-slate-800 mt-2">{tx.note || "بدون بيان وملاحظات"}</p>
                      {tx.imageUrl && (
                        <div className="mt-2">
                          <img 
                            src={tx.imageUrl} 
                            alt="مرفق المعاملة" 
                            className="max-h-24 rounded-lg object-contain border border-slate-100 shadow-sm cursor-zoom-in"
                            onClick={() => window.open(tx.imageUrl!, "_blank")}
                          />
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 font-medium mt-1">
                        التاريخ: {new Date(tx.createdAt).toLocaleDateString("ar-EG")} | {new Date(tx.createdAt).toLocaleTimeString("ar-EG", {hour: "2-digit", minute: "2-digit"})}
                      </p>
                    </div>

                    <div className="text-left space-y-2">
                      <p className="text-base font-black tabular-nums text-slate-800">
                        {tx.kind === "took" && !tx.isAuto ? "-" : ""}{formatDinarAsAlfWithUnit(tx.amount)}
                      </p>
                      
                      {!tx.isAuto ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleStartEdit(tx)}
                            className="px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          >
                            ✏️ تعديل
                          </button>
                          <button
                            onClick={() => handleDeleteTx(tx.id)}
                            className="px-2 py-1 text-[10px] font-black text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            🗑️ حذف
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 items-end">
                          {partner.type === "shop" && tx.id.startsWith("auto-order-") && (
                            <div className="flex gap-2 justify-end items-center">
                              <Link
                                href={`/abo1stor3hlaa2kbr8-47/orders/${tx.id.replace("auto-order-", "")}/edit`}
                                className="px-2.5 py-1.5 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition border border-blue-100 flex items-center gap-1"
                              >
                                📝 تعديل الطلب
                              </Link>
                              {tx.isPaid ? (
                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-1">
                                  ✅ مسدد
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleAdminPayOrder(tx)}
                                  className="px-2.5 py-1.5 text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-900/10 flex items-center gap-1"
                                >
                                  💵 دفع من الإدارة
                                </button>
                              )}
                            </div>
                          )}
                          {tx.isAdminPayment && (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleStartEditAdminPayment(tx)}
                                className="px-2 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100 rounded-lg transition"
                              >
                                ✏️ تعديل الدفع
                              </button>
                              <button
                                onClick={() => handleDeleteAdminPayment(tx.id)}
                                className="px-2 py-1 text-[10px] font-black text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              >
                                🗑️ حذف الدفع
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* مودال تعديل المعاملة */}
      {editTxId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl max-w-md w-full p-6 text-right animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-4">تعديل المعاملة المالية</h3>
            
            <form onSubmit={handleUpdateTx} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">المبلغ</label>
                <input
                  type="text"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-indigo-500 text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">النوع</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditKind("gave")}
                    className={`py-2 text-xs font-black rounded-xl border text-center transition ${
                      editKind === "gave"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    🟢 أعطيت (نطلبه)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditKind("took")}
                    className={`py-2 text-xs font-black rounded-xl border text-center transition ${
                      editKind === "took"
                        ? "bg-rose-50 border-rose-300 text-rose-700"
                        : "bg-white border-slate-200 text-slate-600"
                    }`}
                  >
                    🔴 أخذت (يطلبنا)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">تاريخ المعاملة</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">الملاحظات</label>
                <textarea
                  rows={3}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 text-right"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isEditing}
                  className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition disabled:opacity-50"
                >
                  {isEditing ? "جاري الحفظ..." : "حفظ التغييرات"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditTxId(null)}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال تعديل دفعة الإدارة */}
      {editAdminPaymentId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl max-w-md w-full p-6 text-right animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-4">تعديل قيمة دفعة الإدارة</h3>
            
            <form onSubmit={handleUpdateAdminPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">المبلغ الجديد</label>
                <input
                  type="text"
                  required
                  value={editAdminPaymentAmount}
                  onChange={(e) => setEditAdminPaymentAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-indigo-500 text-left"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isEditingAdminPayment}
                  className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition disabled:opacity-50"
                >
                  {isEditingAdminPayment ? "جاري الحفظ..." : "حفظ التعديل"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditAdminPaymentId(null)}
                  className="px-4 py-2.5 text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
