"use client";

import { whatsappMeUrl, telHref, openUrlFromUserGesture } from "@/lib/whatsapp";

export type PhoneActionModalProps = {
  type: "whatsapp" | "call";
  phone1: string;
  phone2?: string | null;
  messageText?: string;
  onClose: () => void;
};

export function PhoneActionModal({
  type,
  phone1,
  phone2,
  messageText = "",
  onClose,
}: PhoneActionModalProps) {
  const isWhatsapp = type === "whatsapp";

  const handleSelectPhone = (chosenPhone: string) => {
    onClose();
    if (isWhatsapp) {
      const url = whatsappMeUrl(chosenPhone, messageText);
      if (url && url !== "#") {
        openUrlFromUserGesture(url);
      }
    } else {
      window.location.href = telHref(chosenPhone);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* الهيدر */}
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white font-black text-xl shadow-md ${
              isWhatsapp ? "bg-emerald-600" : "bg-sky-600"
            }`}
          >
            {isWhatsapp ? "💬" : "📞"}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {isWhatsapp ? "اختيار رقم الواتساب" : "اختيار رقم الاتصال"}
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              هذا الزبون يمتلك رقمين هاتف، اختر الرقم المطلوب:
            </p>
          </div>
        </div>

        {/* الأزرار التفاعلية للرقم الأول والرقم الثاني */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleSelectPhone(phone1)}
            className={`flex w-full items-center justify-between gap-2 rounded-2xl p-3.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all ${
              isWhatsapp
                ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800"
                : "bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">1️⃣</span>
              <span>الرقم الأول</span>
            </div>
            <span className="font-mono text-sm tracking-wide bg-black/20 px-2.5 py-1 rounded-xl">
              {phone1}
            </span>
          </button>

          {phone2 && (
            <button
              type="button"
              onClick={() => handleSelectPhone(phone2)}
              className={`flex w-full items-center justify-between gap-2 rounded-2xl p-3.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 transition-all ${
                isWhatsapp
                  ? "bg-gradient-to-r from-emerald-700 to-emerald-900 hover:from-emerald-800 hover:to-emerald-950"
                  : "bg-gradient-to-r from-blue-700 to-indigo-900 hover:from-blue-800 hover:to-indigo-950"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">2️⃣</span>
                <span>الرقم الثاني</span>
              </div>
              <span className="font-mono text-sm tracking-wide bg-black/20 px-2.5 py-1 rounded-xl">
                {phone2}
              </span>
            </button>
          )}
        </div>

        {/* زر الإلغاء */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer active:scale-95"
        >
          إلغاء ✖
        </button>
      </div>
    </div>
  );
}
