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
  portalUrl?: string | null;
}

interface PartnerDetailsClientProps {
  partner: Partner;
}

export function PartnerDetailsClient({ partner: initialPartner }: PartnerDetailsClientProps) {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner>(initialPartner);
  
  // نموذج إضافة معاملة
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"gave" | "took">("gave");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const handleOpenForm = (selectedKind: "gave" | "took") => {
    setKind(selectedKind);
    setIsFormOpen(true);
  };


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
    const paymentAmount = tx.remainingAmount !== undefined ? tx.remainingAmount : tx.amount;
    const confirmPay = confirm(`هل أنت متأكد من رغبتك في تسجيل عملية دفع لهذا الطلب بقيمة المتبقي ${formatDinarAsAlfWithUnit(paymentAmount)} من طرف الإدارة مباشرة؟`);
    if (!confirmPay) return;

    const res = await payShopOrderFromAdmin(orderId, paymentAmount);
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
      setIsFormOpen(false);
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

  const getProfileLink = (type: string, externalId: string | null) => {
    if (partner.portalUrl) return partner.portalUrl;
    if (!externalId) return null;
    if (type === "shop") {
      return `/abo1stor3hlaa2kbr8-47/shops/${externalId}/edit`;
    }
    if (type === "courier") {
      return `/abo1stor3hlaa2kbr8-47/couriers/${externalId}/edit`;
    }
    if (type === "preparer") {
      return `/abo1stor3hlaa2kbr8-47/preparers`;
    }
    if (type === "customer") {
      return `/abo1stor3hlaa2kbr8-47/customers/profiles/${externalId}/edit`;
    }
    return null;
  };

  const handleShareWhatsApp = () => {
    const balanceAbs = Math.abs(partner.balance);
    const balanceText = formatDinarAsAlfWithUnit(balanceAbs);
    
    let stateText = "";
    if (partner.balance > 0) {
      stateText = `عليك رصيد بقيمة ${balanceText}`;
    } else if (partner.balance < 0) {
      stateText = `لك رصيد بقيمة ${balanceText}`;
    } else {
      stateText = `رصيدك مصفّر حالياً`;
    }

    const shareUrl = `${window.location.origin}/credit-book/share/${partner.id}`;
    const message = `مرحبا ${partner.name}\n${stateText}\nيمكنك مراجعة الفواتير والمعاملات عبر الرابط التالي:\n${shareUrl}`;
    
    let phoneParam = "";
    if (partner.phone) {
      let num = partner.phone.replace(/\D/g, "");
      if (num.startsWith("07")) {
        num = "964" + num.substring(1);
      } else if (num.startsWith("7") && num.length === 10) {
        num = "964" + num;
      }
      phoneParam = `phone=${num}&`;
    }
    const whatsappUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* هيدر كرت تفاصيل الشريك والورصيد */}
      <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-right flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex flex-wrap items-center gap-3">
            <span>{partner.name}</span>
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {getProfileLink(partner.type, partner.externalId) && (
              <Link
                href={getProfileLink(partner.type, partner.externalId)!}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition border border-blue-200/60 shadow-sm"
                title="فتح بوابة الشخص بالنظام"
              >
                👤 فتح بوابة الحساب بالنظام
              </Link>
            )}
            <button
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition border border-emerald-200/60 shadow-sm"
              title="مشاركة كشف الحساب عبر الواتساب"
            >
              💬 مشاركة عبر الواتساب
            </button>
          </div>
          <p className="text-sm text-slate-500 font-bold mt-1.5">رقم الهاتف: {partner.phone || "غير متوفر"}</p>
          <p className="text-xs text-slate-400 font-medium mt-1">تاريخ الإنشاء: {new Date(partner.createdAt).toLocaleDateString("ar-EG")}</p>
        </div>

        <div className="flex flex-col gap-4 w-full md:w-auto">
          {/* البلوك الحسابي الموحد (أخذت، أعطيت، الكلي) */}
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl min-w-[280px] text-right space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500">
              <span>أعطيت (نطلبه):</span>
              <span className="text-emerald-600 font-black tabular-nums">{formatDinarAsAlfWithUnit(partner.totalGave)}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 pb-2 border-b border-slate-200">
              <span>أخذت (يطلبنا):</span>
              <span className="text-rose-600 font-black tabular-nums">{formatDinarAsAlfWithUnit(partner.totalTook)}</span>
            </div>
            {(partner.type === "courier" || partner.type === "preparer") && (
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 pb-2 border-b border-slate-200">
                <span>متبقي المحفظة للإدارة:</span>
                <span className="text-indigo-700 font-black tabular-nums">{formatDinarAsAlfWithUnit(partner.walletRemain || 0)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs font-black text-slate-700">الكلي:</span>
              <span className="text-sm font-black tabular-nums text-rose-600">
                {partner.balance > 0 ? "نطلبه: " : partner.balance < 0 ? "يطلبنا: " : ""}
                {formatDinarAsAlfWithUnit(Math.abs(partner.balance))}
              </span>
            </div>
          </div>

          {/* زرا تسجيل أعطيت وأخذت لتفعيل البلوك بالأسفل */}
          <div className="flex gap-2">
            <button
              onClick={() => handleOpenForm("gave")}
              className="flex-1 py-2 px-3 text-xs font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition text-center flex items-center justify-center gap-1.5 shadow-sm"
            >
              🟢 تسجيل أعطيت
            </button>
            <button
              onClick={() => handleOpenForm("took")}
              className="flex-1 py-2 px-3 text-xs font-black text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition text-center flex items-center justify-center gap-1.5 shadow-sm"
            >
              🔴 تسجيل أخذت
            </button>
          </div>
        </div>
      </div>

      {/* نموذج إضافة معاملة جديدة بالكامل بشكل أفقي - يتم فتحه فقط عند النقر على الأزرار في الأعلى */}
      {isFormOpen && (
        <div id="manual-tx-form" className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-right animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h3 className="text-md font-black text-slate-800">✍️ تسجيل معاملة يدوية جديدة</h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-rose-600 transition"
              >
                ❌ إغلاق
              </button>
            </div>
            {/* أزرار تصفير الحساب وحذف الحساب */}
            <div className="flex flex-wrap gap-3">
              {partner.balance !== 0 && (
                <button
                  type="button"
                  onClick={handleZeroAccount}
                  className="px-4 py-2 text-xs font-black text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-2xl transition text-center"
                >
                  🧹 تصفير الحساب بالكامل
                </button>
              )}
              <button
                type="button"
                onClick={handleDeletePartner}
                className="px-4 py-2 text-xs font-black text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-2xl transition text-center"
              >
                🗑️ حذف هذا الحساب بالكامل
              </button>
            </div>
          </div>

          <form onSubmit={handleAddTx} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">قيمة المبلغ</label>
              <input
                type="text"
                required
                placeholder="مثال: 50,000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-indigo-500 text-left"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">نوع المعاملة</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setKind("gave")}
                  className={`py-2.5 text-xs font-black rounded-xl border text-center transition ${
                    kind === "gave"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🟢 أعطيت (نطلبه)
                </button>
                <button
                  type="button"
                  onClick={() => setKind("took")}
                  className={`py-2.5 text-xs font-black rounded-xl border text-center transition ${
                    kind === "took"
                      ? "bg-rose-50 border-rose-300 text-rose-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🔴 أخذت (يطلبنا)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">تاريخ المعاملة (اختياري)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 text-right bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">بيان أو ملاحظات</label>
              <input
                type="text"
                placeholder="تفاصيل المعاملة..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 text-right"
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
                className="w-full px-3 py-1.5 rounded-2xl border border-slate-200 text-xs focus:outline-none bg-white text-right"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              {error && <p className="text-[10px] font-bold text-rose-600 leading-tight">{error}</p>}
              <button
                type="submit"
                disabled={isAdding}
                className="w-full px-4 py-3 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition disabled:opacity-50 shadow-md shadow-indigo-900/10"
              >
                {isAdding ? "جاري الحفظ..." : "حفظ المعاملة"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* كشف الحساب وتفاصيل المعاملات التاريخية */}
      <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-right space-y-6">
        <h3 className="text-md font-black text-slate-800">📄 كشف المعاملات التاريخية</h3>

        {partner.transactions.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold">لا يوجد أي معاملات مالية مسجلة لهذا الحساب.</div>
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

                  <div className="flex gap-2">
                    {!tx.isAuto ? (
                      <>
                        <button
                          onClick={() => handleStartEdit(tx)}
                          className="px-2.5 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100 rounded-lg transition"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteTx(tx.id)}
                          className="px-2.5 py-1 text-[10px] font-black text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          🗑️ حذف
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col gap-1 items-end">
                        {partner.type === "shop" && tx.id.startsWith("auto-order-") && (
                          <div className="flex gap-1.5 justify-end items-center flex-wrap">
                            <Link
                              href={`/abo1stor3hlaa2kbr8-47/orders/${tx.id.replace("auto-order-", "")}/edit`}
                              className="px-2 py-1 text-[9px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition border border-blue-100"
                            >
                              📝 تعديل
                            </Link>
                            {tx.isPaid ? (
                              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                                ✅ مسدد
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAdminPayOrder(tx)}
                                className="px-2 py-1 text-[9px] font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-md shadow-indigo-900/10"
                              >
                                💵 دفع
                              </button>
                            )}
                          </div>
                        )}
                        {tx.isAdminPayment && (
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleStartEditAdminPayment(tx)}
                              className="px-2.5 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            >
                              ✏️ تعديل الدفع
                            </button>
                            <button
                              onClick={() => handleDeleteAdminPayment(tx.id)}
                              className="px-2.5 py-1 text-[10px] font-black text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              🗑️ حذف
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
