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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-sm rounded-[24px] border-[1.5px] border-[#C9A86A] bg-[#FFFEFB] p-5 sm:p-6 shadow-[0_10px_30px_rgba(201,168,106,0.25)] space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* الهيدر الأرابيسكي */}
        <div className="flex items-center gap-3 border-b border-[#C9A86A]/25 pb-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-white font-black text-xl shadow-md border ${
              isWhatsapp
                ? "bg-gradient-to-br from-[#0A3D2E] to-[#115740] border-[#C9A86A]/40 text-[#E8C77E]"
                : "bg-gradient-to-br from-[#0B3B5B] to-[#145374] border-[#C9A86A]/40 text-[#E8C77E]"
            }`}
          >
            {isWhatsapp ? "💬" : "📞"}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#0A3D2E]">
              {isWhatsapp ? "اختيار رقم الواتساب" : "اختيار رقم الاتصال"}
            </h3>
            <p className="text-xs font-bold text-[#8B6A2A] mt-0.5">
              هذا الزبون يمتلك رقمين، يرجى اختيار الرقم المطلوب:
            </p>
          </div>
        </div>

        {/* الأزرار التفاعلية للرقم الأول والرقم الثاني */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleSelectPhone(phone1)}
            className="group relative flex w-full items-center justify-between gap-2 rounded-[14px] p-3.5 text-xs sm:text-sm font-black text-[#E8C77E] bg-gradient-to-r from-[#0A3D2E] via-[#0F4D3A] to-[#0A3D2E] border-[1.5px] border-[#C9A86A] shadow-[0_3px_10px_rgba(10,61,46,0.25),inset_0_1px_0_rgba(232,199,126,0.2)] hover:bg-[#115740] active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm px-1.5 py-0.5 rounded-full bg-white/10 text-[#F5D77F] border border-[#C9A86A]/30">1️⃣ أساسي</span>
              <span className="text-[#FFFEFB]">الرقم الأول</span>
            </div>
            <span className="font-mono text-sm tracking-wide bg-[#06281D] text-[#F5D77F] px-2.5 py-1 rounded-xl border border-[#C9A86A]/30" dir="ltr">
              {phone1}
            </span>
          </button>

          {phone2 && (
            <button
              type="button"
              onClick={() => handleSelectPhone(phone2)}
              className="group relative flex w-full items-center justify-between gap-2 rounded-[14px] p-3.5 text-xs sm:text-sm font-black text-[#0A3D2E] bg-gradient-to-r from-[#FFF8E1] via-[#FFFEFB] to-[#F7EAC8] border-[1.5px] border-[#C9A86A] shadow-[0_3px_10px_rgba(201,168,106,0.2),inset_0_1px_0_white] hover:border-[#8B6A2A] active:scale-[0.98] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm px-1.5 py-0.5 rounded-full bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A]/40">2️⃣ بديل</span>
                <span className="text-[#0A3D2E]">الرقم الثاني</span>
              </div>
              <span className="font-mono text-sm tracking-wide bg-[#0A3D2E] text-[#F5D77F] px-2.5 py-1 rounded-xl border border-[#C9A86A]/30" dir="ltr">
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
          className="w-full rounded-[12px] bg-[#FDF6E3] border border-[#C9A86A]/40 py-2.5 text-xs font-black text-[#8B6A2A] hover:bg-[#F6EED7] active:scale-[0.98] transition cursor-pointer"
        >
          إلغاء ✖
        </button>
      </div>
    </div>
  );
}
