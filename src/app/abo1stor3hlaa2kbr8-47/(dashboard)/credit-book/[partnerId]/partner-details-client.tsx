"use client";

import React, { useState, useRef, useEffect } from "react";
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
  zeroPartnerAccount,
  getTransactionAuthorsAction,
  createPartner,
  getUnaddedSystemPartners,
  type PartnerType
} from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/credit-book/actions";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { useRouter } from "next/navigation";

// دالة البحث الذكي الفوري بالتقارب اللفظي للمفاتيح
function fuzzyMatchTx(tx: Transaction, query: string): boolean {
  if (!query) return true;
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const amountStr = String(tx.amount);
  const amountAlfStr = String(tx.amount / 1000);
  const noteStr = (tx.note || "").toLowerCase();
  const kindStr = tx.kind === "gave" ? "أعطيت" : "أخذت";
  
  const txDate = new Date(tx.createdAt);
  const dateStr = txDate.toLocaleDateString("ar-EG").toLowerCase();
  const isoDateStr = txDate.toISOString().substring(0, 10);
  
  return tokens.every(token => {
    if (amountStr.includes(token)) return true;
    if (amountAlfStr.includes(token)) return true;
    if (noteStr.includes(token)) return true;
    if (kindStr.includes(token)) return true;
    if (dateStr.includes(token)) return true;
    if (isoDateStr.includes(token)) return true;
    
    // تطابق الأحرف المتقاربة بالترتيب
    let charIdx = 0;
    for (let i = 0; i < noteStr.length; i++) {
      if (noteStr[i] === token[charIdx]) {
        charIdx++;
        if (charIdx === token.length) return true;
      }
    }
    return false;
  });
}

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

interface ActivePartnerSummary {
  id: string;
  name: string;
}

interface PartnerDetailsClientProps {
  partner: Partner;
  allActivePartners: ActivePartnerSummary[];
}

export function PartnerDetailsClient({ partner: initialPartner, allActivePartners }: PartnerDetailsClientProps) {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner>(initialPartner);
  
  const [searchQuery, setSearchQuery] = useState("");

  // نموذج إضافة شريك جديد (للاقتراحات)
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState("");
  const [newPartnerPhone, setNewPartnerPhone] = useState("");
  const [newPartnerType, setNewPartnerType] = useState<PartnerType>("external");
  const [unaddedSystemPartners, setUnaddedSystemPartners] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [systemPartnerSearch, setSystemPartnerSearch] = useState("");
  const [selectedSystemPartnerId, setSelectedSystemPartnerId] = useState("");
  const [isLoadingUnadded, setIsLoadingUnadded] = useState(false);
  const [addPartnerError, setAddPartnerError] = useState("");
  const [isAddingPartner, setIsAddingPartner] = useState(false);

  const loadUnaddedPartners = async (type: PartnerType) => {
    setSystemPartnerSearch("");
    if (type === "external") {
      setUnaddedSystemPartners([]);
      setSelectedSystemPartnerId("");
      return;
    }
    setIsLoadingUnadded(true);
    const list = await getUnaddedSystemPartners(type);
    setUnaddedSystemPartners(list);
    setIsLoadingUnadded(false);
    setSelectedSystemPartnerId("");
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) {
      setAddPartnerError("الرجاء إدخال الاسم");
      return;
    }
    setIsAddingPartner(true);
    setAddPartnerError("");
    const res = await createPartner(
      newPartnerName,
      newPartnerPhone || null,
      newPartnerType,
      selectedSystemPartnerId || undefined
    );
    setIsAddingPartner(false);
    if (res.success) {
      setNewPartnerName("");
      setNewPartnerPhone("");
      setNewPartnerType("external");
      setSelectedSystemPartnerId("");
      setUnaddedSystemPartners([]);
      setShowAddPartnerModal(false);
      if (res.partner?.id) {
        router.push(`/abo1stor3hlaa2kbr8-47/credit-book/${res.partner.id}`);
      }
    } else {
      setAddPartnerError(res.error || "حدث خطأ ما");
    }
  };

  // اقتراحات الحسابات الأخرى
  const matchingPartners = searchQuery.trim() === ""
    ? []
    : allActivePartners.filter(p =>
        p.id !== partner.id &&
        p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      ).slice(0, 3);
  
  const [authors, setAuthors] = useState<Record<string, { createdBy: string; modifiedBy?: string }>>({});

  useEffect(() => {
    getTransactionAuthorsAction().then(setAuthors);
  }, [partner.transactions]);
  
  // نموذج إضافة معاملة
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"gave" | "took">("gave");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const [showCalc, setShowCalc] = useState(false);
  const [calcExpr, setCalcExpr] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);

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
    
    let parsedAmountStr = amount.trim();
    let parsedNote = note.trim();

    // البحث عن أول تسلسل للأرقام (والذي قد يحتوي على فواصل أو نقاط)
    const numRegex = /[\d,]+(?:\.\d+)?/;
    const match = parsedAmountStr.match(numRegex);
    if (match) {
      const matchedNumStr = match[0];
      const cleanNumStr = matchedNumStr.replace(/,/g, "");
      const parsedVal = parseFloat(cleanNumStr);
      if (!isNaN(parsedVal)) {
        // استخلاص النص المتبقي كبيان أو ملاحظات
        const textPart = parsedAmountStr.replace(matchedNumStr, "").trim();
        if (textPart) {
          parsedAmountStr = cleanNumStr;
          parsedNote = parsedNote ? `${textPart} - ${parsedNote}` : textPart;
        } else {
          parsedAmountStr = cleanNumStr;
        }
      }
    }

    const numAmt = parseFloat(parsedAmountStr);
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
    const res = await addTransaction(partner.id, numAmt, kind, parsedNote, selectedDate, uploadedUrl);
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
          <h2 className="text-xl font-black flex flex-wrap items-center gap-3">
            <span className={
              partner.balance > 0 
                ? "text-emerald-600" 
                : partner.balance < 0 
                  ? "text-rose-600" 
                  : "text-slate-800"
            }>{partner.name}</span>
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
              <span className={`text-sm font-black tabular-nums ${
                partner.balance > 0 ? "text-emerald-600" : partner.balance < 0 ? "text-rose-600" : "text-slate-500"
              }`}>
                {partner.balance > 0 ? "نطلبه: " : partner.balance < 0 ? "يطلبنا: " : ""}
                {formatDinarAsAlfWithUnit(Math.abs(partner.balance))}
              </span>
            </div>
          </div>

          {/* زرا تسجيل أعطيت وأخذت وتصفير الحساب */}
          <div className="flex flex-wrap gap-2">
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
            {partner.balance !== 0 && (
              <button
                onClick={handleZeroAccount}
                className="flex-1 py-2 px-3 text-xs font-black text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition text-center flex items-center justify-center gap-1.5 shadow-sm"
              >
                🧹 تصفير الحساب
              </button>
            )}
          </div>
        </div>
      </div>

      {/* نموذج إضافة معاملة جديدة بالكامل بشكل أفقي - يتم فتحه فقط عند النقر على الأزرار في الأعلى */}
      {isFormOpen && (
        <div id="manual-tx-form" className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm text-right animate-in fade-in slide-in-from-top-4 duration-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <h3 className="text-md font-black text-slate-800">
                ✍️ تسجيل {kind === "gave" ? "🟢 أعطيت (نطلبه)" : "🔴 أخذت (يطلبنا)"} جديد
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setShowCalc(false);
                }}
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

          {/* الحاسبة الذكية المدمجة */}
          {showCalc && (
            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-right animate-in zoom-in-95 duration-150 max-w-sm ml-auto">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-black text-slate-500">🧮 حاسبة سريعة للمعاملة</span>
                <button 
                  type="button" 
                  onClick={() => setShowCalc(false)} 
                  className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition"
                >
                  إغلاق ❌
                </button>
              </div>
              <div className="bg-white border border-slate-200 p-3 rounded-xl mb-3 text-left font-mono text-lg font-bold text-slate-800 break-all select-all min-h-[44px] flex items-center justify-end">
                {calcExpr || "0"}
              </div>
              <div className="grid grid-cols-4 gap-2 font-black">
                {["7", "8", "9", "/"].map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => setCalcExpr(prev => prev + char)}
                    className="p-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-sm transition text-slate-800"
                  >
                    {char}
                  </button>
                ))}
                {["4", "5", "6", "*"].map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => setCalcExpr(prev => prev + char)}
                    className="p-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-sm transition text-slate-800"
                  >
                    {char}
                  </button>
                ))}
                {["1", "2", "3", "-"].map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => setCalcExpr(prev => prev + char)}
                    className="p-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-sm transition text-slate-800"
                  >
                    {char}
                  </button>
                ))}
                {["0", ".", "C", "+"].map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => {
                      if (char === "C") {
                        setCalcExpr("");
                      } else {
                        setCalcExpr(prev => prev + char);
                      }
                    }}
                    className="p-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-sm transition text-slate-800"
                  >
                    {char}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 font-black">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      if (!calcExpr) return;
                      if (!/^[0-9+\-*/().\s]+$/.test(calcExpr)) {
                        alert("تعبير رياضي غير صالح");
                        return;
                      }
                      const result = Function(`"use strict"; return (${calcExpr})`)();
                      setCalcExpr(String(result));
                    } catch (err) {
                      alert("خطأ في العملية الحسابية");
                    }
                  }}
                  className="py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs rounded-xl transition"
                >
                  = احسب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      if (!calcExpr) return;
                      if (!/^[0-9+\-*/().\s]+$/.test(calcExpr)) {
                        alert("تعبير رياضي غير صالح");
                        return;
                      }
                      const result = Function(`"use strict"; return (${calcExpr})`)();
                      setAmount(String(result));
                      setShowCalc(false);
                    } catch (err) {
                      alert("خطأ في العملية الحسابية");
                    }
                  }}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl transition"
                >
                  📥 إدخال المبلغ
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleAddTx} className="space-y-4 max-w-xl">
            {/* 1. سعر الفاتورة مع زر الحاسبة */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-black text-slate-500">سعر الفاتورة</label>
                <button
                  type="button"
                  onClick={() => {
                    setCalcExpr("");
                    setShowCalc(!showCalc);
                  }}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
                >
                  🧮 فتح الحاسبة
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="أدخل السعر (مثال: 50,000 أو سلفة 25000)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    noteRef.current?.focus();
                  }
                }}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-indigo-500 text-right bg-slate-50/50"
              />
            </div>

            {/* 2. بيان أو ملاحظات */}
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1.5">بيان أو ملاحظات (التفاصيل)</label>
              <textarea
                ref={noteRef}
                placeholder="تفاصيل المعاملة..."
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddTx(e);
                  }
                }}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 text-right"
              />
            </div>

            {/* 3. تاريخ المعاملة وصورة المعاملة (جنباً إلى جنب) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="block text-xs font-black text-slate-500 mb-1.5">إرفاق صورة المعاملة (اختياري)</label>
                <input
                  id="tx-image-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                  }}
                  className="w-full px-4 py-2 rounded-2xl border border-slate-200 text-xs focus:outline-none bg-white text-right"
                />
              </div>
            </div>

            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={isAdding}
              className="w-full px-4 py-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition disabled:opacity-50 shadow-md shadow-indigo-900/10"
            >
              {isAdding ? "جاري الحفظ..." : "حفظ المعاملة بالدفتر"}
            </button>
          </form>
        </div>
      )}

      {/* كشف الحساب وتفاصيل المعاملات التاريخية */}
      <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-6 rounded-3xl shadow-sm text-right space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-md font-black text-slate-800 dark:text-slate-200">📄 كشف المعاملات التاريخية</h3>
          
          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="ابحث في هذا الحساب (سعر، تاريخ، تفاصيل)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500 text-right bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        {searchQuery.trim() !== "" && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-150/50 dark:border-slate-800 rounded-2xl flex flex-col gap-2.5">
            {/* 1. حسابات مطابقة */}
            {matchingPartners.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-black text-slate-400">📌 الانتقال لحساب آخر يتطابق مع بحثك:</span>
                <div className="flex flex-wrap gap-2">
                  {matchingPartners.map(p => (
                    <Link
                      key={p.id}
                      href={`/abo1stor3hlaa2kbr8-47/credit-book/${p.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-150 dark:border-indigo-900/40 rounded-xl hover:bg-indigo-100 transition"
                    >
                      👤 {p.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            {/* 2. اقتراح إنشاء حساب جديد */}
            {(matchingPartners.length === 0 && !/\d/.test(searchQuery.trim()) && searchQuery.trim().length >= 2) && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-slate-500 font-bold">💡 لا يوجد حساب باسم "{searchQuery.trim()}" في الدفتر.</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewPartnerName(searchQuery.trim());
                    setNewPartnerPhone("");
                    setNewPartnerType("external");
                    setSelectedSystemPartnerId("");
                    setShowAddPartnerModal(true);
                  }}
                  className="inline-flex items-center justify-center px-3.5 py-1.5 text-[11px] font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm self-end sm:self-auto"
                >
                  ➕ إنشاء حساب جديد لـ "{searchQuery.trim()}"
                </button>
              </div>
            )}
          </div>
        )}

        {partner.transactions.length === 0 ? (
          <div className="py-20 text-center text-slate-400 font-bold">لا يوجد أي معاملات مالية مسجلة لهذا الحساب.</div>
        ) : (
          (() => {
            // حساب الرصيد التراكمي لكل حركة من الأقدم للأحدث ثم إعادة الترتيب للأحدث
            let currentRunning = 0;
            const txsWithRunningBalance = [...partner.transactions]
              .reverse()
              .map((tx) => {
                const amt = tx.amount;
                if (tx.kind === "gave") {
                  currentRunning += amt;
                } else if (tx.kind === "took") {
                  currentRunning -= amt;
                }
                return {
                  ...tx,
                  runningBalance: currentRunning
                };
              })
              .reverse();

            const filteredTxs = txsWithRunningBalance.filter(tx => fuzzyMatchTx(tx, searchQuery));

            if (filteredTxs.length === 0) {
              return <div className="py-20 text-center text-slate-400 font-bold">لا يوجد أي معاملات مطابقة لمصطلح البحث.</div>;
            }

            return (
              <div className="space-y-3 max-h-[800px] overflow-y-auto pr-1">
                {filteredTxs.map((tx) => {
                  const notesLower = tx.notes?.toLowerCase() || "";
                  const isSalary = notesLower.includes("[راتب]") || notesLower.includes("راتب");
                  const isTransfer = notesLower.includes("تحويل");
                  const isDebt = notesLower.includes("دين");

                  let containerClasses = "";
                  let tagClasses = "";

                  if (isSalary) {
                    // أزرق متدرج للأبيض مثل محفظة المجهز تماماً
                    containerClasses = "border-[#4f46e5] bg-gradient-to-r from-[#818cf8]/35 via-[#c7d2fe]/10 to-white hover:from-[#818cf8]/45 hover:via-[#c7d2fe]/20 hover:to-white/95 dark:from-[#2e2a72]/40 dark:to-[#0b0b1a] dark:border-[#6366f1] text-[#1e1b4b] dark:text-[#e0e7ff] ring-2 ring-[#4f46e5]/40";
                    tagClasses = "bg-[#4f46e5]/10 text-[#4f46e5] border-[#4f46e5]/20 dark:bg-[#6366f1]/20 dark:text-[#a5b4fc] dark:border-[#6366f1]/30";
                  } else if (isDebt) {
                    containerClasses = "border-yellow-500 bg-yellow-50/60 hover:bg-yellow-100/70 dark:bg-yellow-950/20 dark:border-yellow-900 text-yellow-950 dark:text-yellow-250 ring-2 ring-yellow-400/60";
                    tagClasses = "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-350 dark:border-yellow-900";
                  } else if (isTransfer) {
                    // بنفسجي غامق مثل زر التحويل في المحفظة
                    containerClasses = "border-violet-700 bg-violet-600 text-white hover:bg-violet-650/95 dark:bg-violet-900 dark:border-violet-800 dark:text-violet-100 ring-2 ring-violet-500/30";
                    tagClasses = "bg-white/20 text-white border-white/25 dark:bg-violet-950/40 dark:text-violet-350 dark:border-violet-900";
                  } else if (tx.kind === "gave") {
                    containerClasses = "bg-emerald-50/15 dark:bg-emerald-950/20 border border-emerald-100/75 dark:border-emerald-900/40 hover:bg-emerald-50/25 dark:hover:bg-emerald-950/30";
                    tagClasses = "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50";
                  } else {
                    containerClasses = "bg-rose-50/15 dark:bg-red-950/15 border border-rose-100/75 dark:border-red-900/30 hover:bg-rose-50/25 dark:hover:bg-red-950/20";
                    tagClasses = "bg-rose-50 dark:bg-red-950/40 text-rose-700 dark:text-red-400 border-rose-200 dark:border-red-900/40";
                  }

                  return (
                    <div 
                      key={tx.id} 
                      className={`p-4 rounded-2xl transition flex flex-col gap-3 shadow-sm ${containerClasses}`}
                    >
                      {/* السطر الأول: أزرار الحالة، التاريخ، الباقي، وإجراءات التحكم */}
                      <div className="flex flex-wrap items-center justify-between gap-3 w-full" dir="rtl">
                        
                        {/* الجهة اليمنى: زر أخذت/أعطيت + التاريخ والوقت + الرصيد المتبقي (الباقي) */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* زر أخذت / أعطيت */}
                          <span className={`text-xs md:text-sm font-black px-4 py-2 rounded-xl border ${tagClasses}`}>
                            {tx.kind === "gave" ? "أعطيت" : "أخذت"} {formatDinarAsAlfWithUnit(tx.amount)}
                          </span>

                          {/* التاريخ والوقت */}
                          <span className={`text-[11px] md:text-xs font-bold ${isTransfer ? "text-violet-200/90" : "text-slate-400 dark:text-slate-500"}`}>
                            {new Date(tx.createdAt).toLocaleDateString("ar-EG")} {new Date(tx.createdAt).toLocaleTimeString("ar-EG", {hour: "2-digit", minute: "2-digit"})}
                          </span>

                          {/* الرصيد المتبقي (الباقي) */}
                          <span className={`text-[11px] md:text-xs font-bold px-3 py-1.5 rounded-xl border ${
                            isTransfer 
                              ? "bg-white/10 text-white border-white/10" 
                              : "bg-slate-100 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-800"
                          }`}>
                            الباقي <span className="tabular-nums font-black">{formatDinarAsAlfWithUnit(tx.runningBalance)}</span>
                          </span>

                          {/* وسم تلقائي في حال كانت حركة من النظام */}
                          {tx.isAuto && (
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border ${
                              isTransfer 
                                ? "bg-white/10 text-white border-white/10" 
                                : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40"
                            }`}>
                              ⚙️ تلقائي
                            </span>
                          )}

                          {/* معلومات المنشئ والمعدل */}
                          {(authors[tx.id] && !tx.isAuto) && (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${
                              isTransfer 
                                ? "bg-white/10 text-violet-100 border-white/10" 
                                : "bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800"
                            }`}>
                              {authors[tx.id]?.modifiedBy 
                                ? `بواسطة: ${authors[tx.id].createdBy} (عُدّل: ${authors[tx.id].modifiedBy})`
                                : `بواسطة: ${authors[tx.id].createdBy}`}
                            </span>
                          )}
                        </div>

                        {/* الجهة اليسرى: أزرار الإجراءات (تعديل، حذف، إلخ) */}
                        <div className="flex items-center gap-2">
                          {/* تعديل/حذف للعمليات اليدوية */}
                          {!tx.isAuto ? (
                            <>
                              <button
                                onClick={() => handleStartEdit(tx)}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-xl transition shadow-sm cursor-pointer ${
                                  isTransfer
                                    ? "text-violet-100 bg-white/15 border border-white/10 hover:bg-white/25"
                                    : "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-250 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                                }`}
                              >
                                ✏️ تعديل
                              </button>
                              <button
                                onClick={() => handleDeleteTx(tx.id)}
                                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-xl transition shadow-sm cursor-pointer ${
                                  isTransfer
                                    ? "text-rose-200 bg-rose-500/20 border border-rose-500/20 hover:bg-rose-500/35"
                                    : "text-rose-700 dark:text-rose-450 bg-rose-50 dark:bg-red-950/30 border border-rose-200 dark:border-red-900/30 hover:bg-rose-100 dark:hover:bg-red-950/50"
                                }`}
                              >
                                🗑️ حذف
                              </button>
                            </>
                          ) : (
                            <div className="flex gap-1.5">
                              {partner.type === "shop" && tx.id.startsWith("auto-order-") && (
                                <>
                                  <Link
                                    href={`/abo1stor3hlaa2kbr8-47/orders/${tx.id.replace("auto-order-", "")}/edit`}
                                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition shadow-sm ${
                                      isTransfer
                                        ? "text-violet-150 bg-white/15 border border-white/10 hover:bg-white/25"
                                        : "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/30 hover:bg-blue-100"
                                    }`}
                                  >
                                    📝 تعديل الطلب
                                  </Link>
                                  {tx.isPaid ? (
                                    <span className={`text-xs font-black px-3 py-1.5 rounded-xl border ${
                                      isTransfer
                                        ? "text-violet-200 bg-white/10 border-white/10"
                                        : "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40"
                                    }`}>
                                      ✅ مسدد
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleAdminPayOrder(tx)}
                                      className={`px-3 py-1.5 text-xs font-black rounded-xl transition shadow-md cursor-pointer ${
                                        isTransfer
                                          ? "text-violet-950 bg-white hover:bg-violet-50 shadow-white/5"
                                          : "text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/10"
                                      }`}
                                    >
                                      💵 دفع
                                    </button>
                                  )}
                                </>
                              )}
                              {tx.isAdminPayment && (
                                <>
                                  <button
                                    onClick={() => handleStartEditAdminPayment(tx)}
                                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition shadow-sm cursor-pointer ${
                                      isTransfer
                                        ? "text-violet-100 bg-white/15 border border-white/10 hover:bg-white/25"
                                        : "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-250 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                                    }`}
                                  >
                                    ✏️ تعديل الدفع
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAdminPayment(tx.id)}
                                    className={`px-3 py-1.5 text-xs font-black rounded-xl transition shadow-sm cursor-pointer ${
                                      isTransfer
                                        ? "text-rose-200 bg-rose-500/20 border border-rose-500/20 hover:bg-rose-500/35"
                                        : "text-rose-700 dark:text-rose-450 bg-rose-50 dark:bg-red-950/30 border border-rose-200 dark:border-red-900/30 hover:bg-rose-100 dark:hover:bg-red-950/50"
                                    }`}
                                  >
                                    🗑️ حذف الدفع
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                      </div>

                      {/* السطر الثاني: نص الملاحظة والصورة المرفقة */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-right" dir="rtl">
                        <p className={`text-sm font-black ${isTransfer ? "text-violet-200" : isSalary ? "text-[#4f46e5] dark:text-[#a5b4fc]" : "text-purple-700 dark:text-purple-400"}`}>
                          ملاحظة: <span className={`font-bold ${isTransfer ? "text-white" : isSalary ? "text-[#1e1b4b] dark:text-[#e0e7ff]" : "text-slate-700 dark:text-slate-200"}`}>{tx.note || "بدون بيان وملاحظات"}</span>
                        </p>

                        {tx.imageUrl && (
                          <div className="self-end md:self-center">
                            <img 
                              src={tx.imageUrl} 
                              alt="مرفق المعاملة" 
                              className={`max-h-16 rounded-xl object-contain shadow-sm cursor-zoom-in border ${
                                isTransfer ? "border-white/10" : "border-slate-250 dark:border-slate-800"
                              }`}
                              onClick={() => window.open(tx.imageUrl!, "_blank")}
                            />
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            );
          })()
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
      {/* مودال إضافة زبون/طرف جديد من الاقتراحات */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl max-w-md w-full p-6 text-right animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-4">إضافة شريك/زبون جديد لدفتر الديون</h3>
            
            <form onSubmit={handleCreatePartner} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">الاسم بالكامل</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: علي محمد"
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: 07701234567"
                  value={newPartnerPhone}
                  onChange={(e) => setNewPartnerPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 mb-1.5">النوع/التصنيف</label>
                <select
                  value={newPartnerType}
                  onChange={(e) => {
                    const type = e.target.value as PartnerType;
                    setNewPartnerType(type);
                    loadUnaddedPartners(type);
                  }}
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="external">طرف خارجي (شخص أو حساب آخر)</option>
                  <option value="customer">زبون</option>
                  <option value="shop">محل</option>
                  <option value="preparer">مجهز</option>
                  <option value="courier">مندوب</option>
                  <option value="supplier">مورد</option>
                </select>
              </div>

              {newPartnerType !== "external" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">ابحث باسم الحساب</label>
                    <input
                      type="text"
                      placeholder="اكتب اسم الحساب هنا للبحث والتصفية..."
                      value={systemPartnerSearch}
                      onChange={(e) => setSystemPartnerSearch(e.target.value)}
                      className="w-full px-4 py-2 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5">
                      {selectedSystemPartnerId ? "الحساب المحدد للربط التلقائي:" : "اختر الحساب للربط التلقائي:"}
                    </label>
                    
                    {selectedSystemPartnerId && (
                      <div className="mb-2.5 p-3 bg-indigo-50 text-indigo-900 rounded-2xl text-xs font-black flex justify-between items-center border border-indigo-100">
                        <span>
                          📍 {newPartnerName} {newPartnerPhone ? `(${newPartnerPhone})` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSystemPartnerId("");
                            setNewPartnerName("");
                            setNewPartnerPhone("");
                          }}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-black border border-rose-200 px-2 py-0.5 rounded-lg bg-white transition"
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    )}

                    {isLoadingUnadded ? (
                      <div className="text-xs text-slate-500 py-2">جاري تحميل القائمة...</div>
                    ) : unaddedSystemPartners.length === 0 ? (
                      <div className="text-xs text-rose-500 font-bold py-2">جميع الحسابات من هذا النوع مضافة مسبقاً!</div>
                    ) : (
                      <div className="border border-slate-200 rounded-2xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white">
                        {unaddedSystemPartners
                          .filter(item => {
                            const query = systemPartnerSearch.toLowerCase();
                            const matchesName = item.name.toLowerCase().includes(query);
                            const matchesPhone = item.phone && item.phone.toLowerCase().includes(query);
                            return matchesName || matchesPhone;
                          })
                          .map((item) => {
                            const isSelected = selectedSystemPartnerId === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSystemPartnerId(item.id);
                                  setNewPartnerName(item.name);
                                  setNewPartnerPhone(item.phone || "");
                                }}
                                className={`w-full text-right px-4 py-3 text-xs font-bold transition flex justify-between items-center ${
                                  isSelected 
                                    ? "bg-indigo-50 text-indigo-700 font-black border-r-4 border-indigo-600" 
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span>{item.name} {item.phone ? `(${item.phone})` : ""}</span>
                                {isSelected && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black">محدد ✅</span>}
                              </button>
                            );
                          })
                        }
                      </div>
                    )}
                  </div>
                </div>
              )}

              {addPartnerError && <p className="text-xs font-bold text-rose-600">{addPartnerError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isAddingPartner}
                  className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition disabled:opacity-50"
                >
                  {isAddingPartner ? "جاري الإضافة..." : "حفظ الشريك"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
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
